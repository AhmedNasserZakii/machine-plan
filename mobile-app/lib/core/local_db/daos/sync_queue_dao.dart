import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:sqflite/sqflite.dart';

class SyncQueueDao {
  const SyncQueueDao(this._database);

  final AppDatabase _database;

  Database get _db => _database.db;

  Future<void> insert(SyncQueueItem item) async {
    await _db.insert(
      'sync_queue',
      item.toRow(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> update(SyncQueueItem item) async {
    await _db.update(
      'sync_queue',
      item.toRow(),
      where: 'client_uuid = ?',
      whereArgs: <String>[item.clientUuid],
    );
  }

  Future<void> delete(String clientUuid) async {
    await _db.delete('sync_queue', where: 'client_uuid = ?', whereArgs: <String>[clientUuid]);
  }

  Future<SyncQueueItem?> findByClientUuid(String clientUuid) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'sync_queue',
      where: 'client_uuid = ?',
      whereArgs: <String>[clientUuid],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return SyncQueueItem.fromRow(rows.first);
  }

  /// Every item not yet finished, in the order the queue processor must push
  /// them: media first (`priority` 0), then operations (`priority` 1), FIFO
  /// within each.
  Future<List<SyncQueueItem>> pending() async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'sync_queue',
      where: 'status IN (?, ?)',
      whereArgs: <String>[SyncItemStatus.pending.name, SyncItemStatus.inFlight.name],
      orderBy: 'priority ASC, created_at ASC',
    );
    return rows.map(SyncQueueItem.fromRow).toList(growable: false);
  }

  Future<List<SyncQueueItem>> all() async {
    final List<Map<String, dynamic>> rows =
        await _db.query('sync_queue', orderBy: 'created_at ASC');
    return rows.map(SyncQueueItem.fromRow).toList(growable: false);
  }

  Future<List<SyncQueueItem>> byStatus(SyncItemStatus status) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: <String>[status.name],
      orderBy: 'created_at ASC',
    );
    return rows.map(SyncQueueItem.fromRow).toList(growable: false);
  }

  /// Everything still occupying the user's attention or the queue itself —
  /// what `PendingSyncCounter`/the logout warning counts.
  Future<int> countUnresolved() async {
    final List<Map<String, dynamic>> rows = await _db.rawQuery(
      'SELECT COUNT(*) AS c FROM sync_queue WHERE status IN (?, ?, ?)',
      <String>[SyncItemStatus.pending.name, SyncItemStatus.inFlight.name, SyncItemStatus.conflict.name],
    );
    return Sqflite.firstIntValue(rows) ?? 0;
  }

  Future<void> clear() => _db.delete('sync_queue');
}
