import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// The device's offline mirror (`07`): read-only caches of reference data plus
/// the durable write queue and staged media that make a hand-off recorded with
/// no signal arrive at the server once one comes back.
///
/// Schema is versioned and migrated in numbered steps rather than a single
/// `onCreate` script, so `onUpgrade` is real, exercised code — not a path that
/// only ever runs in production the first time a column is added.
class AppDatabase {
  AppDatabase._(this.db);

  final Database db;

  /// The current schema. Bump this and add a new entry to [_migrations] to
  /// change the schema — never edit an already-shipped migration's SQL.
  static const int currentVersion = 2;

  static Future<AppDatabase> open({String? path, int? version}) async {
    final String resolvedPath = path ?? await _defaultPath();

    final Database db = await openDatabase(
      resolvedPath,
      version: version ?? currentVersion,
      onCreate: (Database db, int version) => _upgrade(db, 0, version),
      onUpgrade: _upgrade,
      onConfigure: (Database db) => db.execute('PRAGMA foreign_keys = ON'),
    );

    return AppDatabase._(db);
  }

  static Future<String> _defaultPath() async {
    final String dbDir = await getDatabasesPath();
    return p.join(dbDir, 'machinery_local.db');
  }

  Future<void> close() => db.close();

  /// Runs every migration strictly after [oldVersion] up to and including
  /// [newVersion], in order. A fresh install passes `oldVersion: 0`, which is
  /// why `onCreate` and `onUpgrade` share this one function — there is exactly
  /// one way tables come into existence, not two that can drift apart.
  static Future<void> _upgrade(Database db, int oldVersion, int newVersion) async {
    for (int version = oldVersion + 1; version <= newVersion; version++) {
      final List<String>? statements = _migrations[version];
      if (statements == null) continue;

      for (final String statement in statements) {
        await db.execute(statement);
      }
    }
  }

  static final Map<int, List<String>> _migrations = <int, List<String>>{
    1: _v1CachedReferenceData,
    2: _v2SyncQueueAndMedia,
  };

  // ── v1: read-only mirrors of server data (`07`, "Cached reference data") ──
  //
  // Every row carries the id, the columns actually queried against (search,
  // ownership, status), `updated_at`/`synced_at`, and the full server JSON —
  // reads reconstruct the entity from the JSON; the scalar columns exist only
  // to let SQL filter/sort without deserializing every row first.
  static const List<String> _v1CachedReferenceData = <String>[
    '''
    CREATE TABLE cached_machines (
      id TEXT PRIMARY KEY,
      serial TEXT NOT NULL,
      status TEXT NOT NULL,
      holder_type TEXT,
      holder_id TEXT,
      branch_id TEXT,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      json TEXT NOT NULL
    )
    ''',
    'CREATE INDEX idx_cached_machines_serial ON cached_machines(serial)',
    'CREATE INDEX idx_cached_machines_holder ON cached_machines(holder_type, holder_id)',
    'CREATE INDEX idx_cached_machines_status ON cached_machines(status)',

    '''
    CREATE TABLE cached_merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      shop_name TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      json TEXT NOT NULL
    )
    ''',
    'CREATE INDEX idx_cached_merchants_phone ON cached_merchants(phone)',

    '''
    CREATE TABLE cached_branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      json TEXT NOT NULL
    )
    ''',

    // A generic bucket for the small, rarely-changing lookup lists the sync
    // bootstrap carries (machine types/models, payment methods, violation
    // types, maintenance locations, decommission reasons, finance
    // categories) — one table rather than seven near-identical ones, since
    // every reader only ever wants "every row in category X, in order".
    '''
    CREATE TABLE cached_lookups (
      category TEXT NOT NULL,
      id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL,
      json TEXT NOT NULL,
      PRIMARY KEY (category, id)
    )
    ''',
    'CREATE INDEX idx_cached_lookups_category ON cached_lookups(category, sort_order)',

    '''
    CREATE TABLE cached_transfers (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      json TEXT NOT NULL
    )
    ''',
    'CREATE INDEX idx_cached_transfers_status ON cached_transfers(status)',
  ];

  // ── v2: the write queue and staged media (`07`, "The operation queue") ──
  static const List<String> _v2SyncQueueAndMedia = <String>[
    '''
    CREATE TABLE sync_queue (
      client_uuid TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      occurred_at TEXT,
      created_at TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      next_retry_at TEXT,
      status TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      server_state TEXT,
      server_id TEXT,
      priority INTEGER NOT NULL DEFAULT 1,
      depends_on TEXT NOT NULL DEFAULT '[]'
    )
    ''',
    // FIFO within a priority: media (0) always drains before operations (1).
    'CREATE INDEX idx_sync_queue_order ON sync_queue(status, priority, created_at)',
    'CREATE INDEX idx_sync_queue_next_retry ON sync_queue(next_retry_at)',

    '''
    CREATE TABLE pending_media (
      client_uuid TEXT PRIMARY KEY,
      local_path TEXT NOT NULL,
      purpose TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      server_media_id TEXT,
      upload_state TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
    ''',
    'CREATE INDEX idx_pending_media_state ON pending_media(upload_state)',
  ];
}
