import 'dart:convert';

import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/feature/machines/data/models/machine_response_model.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:sqflite/sqflite.dart';

/// The local mirror of `myMachines`/machine list rows (`07`).
///
/// Rows are keyed on the server id and store the raw response JSON verbatim —
/// [MachineResponseModel.fromJson] already tolerates the narrower list-item
/// shape bootstrap/delta send versus a full detail fetch, so one row shape
/// serves both a cached list and (once fetched once) a cached detail.
class CachedMachinesDao {
  const CachedMachinesDao(this._database);

  final AppDatabase _database;

  Database get _db => _database.db;

  Future<void> upsertAll(List<Map<String, dynamic>> rows, {String? syncedAt}) async {
    if (rows.isEmpty) return;

    final String synced = syncedAt ?? DateTime.now().toUtc().toIso8601String();
    final Batch batch = _db.batch();

    for (final Map<String, dynamic> json in rows) {
      final Map<String, dynamic>? holder = json['holder'] as Map<String, dynamic>?;
      final Map<String, dynamic>? branch = json['branch'] as Map<String, dynamic>?;

      batch.insert(
        'cached_machines',
        <String, dynamic>{
          'id': json['id']?.toString() ?? '',
          'serial': json['serial'] as String? ?? '',
          'status': json['status'] as String? ?? '',
          'holder_type': holder?['type'] as String?,
          'holder_id': holder?['id']?.toString(),
          'branch_id': branch?['id']?.toString(),
          'updated_at': json['updatedAt'] as String? ?? synced,
          'synced_at': synced,
          'json': jsonEncode(json),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }

    await batch.commit(noResult: true);
  }

  Future<void> deleteByIds(List<String> ids) async {
    if (ids.isEmpty) return;
    final String placeholders = List.filled(ids.length, '?').join(',');
    await _db.delete('cached_machines', where: 'id IN ($placeholders)', whereArgs: ids);
  }

  Future<MachineEntity?> findById(String id) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_machines',
      where: 'id = ?',
      whereArgs: <String>[id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _toEntity(rows.first);
  }

  /// Machines held by [holderType]/[holderId] — a representative's own kit, or
  /// a merchant's installed base. Both are how the "my machines" list and a
  /// merchant detail screen read while offline.
  Future<List<MachineEntity>> findByHolder({
    required String holderType,
    required String holderId,
  }) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_machines',
      where: 'holder_type = ? AND holder_id = ?',
      whereArgs: <String>[holderType, holderId],
      orderBy: 'serial ASC',
    );
    return rows.map(_toEntity).toList(growable: false);
  }

  Future<List<MachineEntity>> search({String? query, int limit = 100}) async {
    final String? trimmed = query?.trim();

    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_machines',
      where: trimmed == null || trimmed.isEmpty ? null : 'serial LIKE ?',
      whereArgs: trimmed == null || trimmed.isEmpty ? null : <String>['%$trimmed%'],
      orderBy: 'serial ASC',
      limit: limit,
    );
    return rows.map(_toEntity).toList(growable: false);
  }

  Future<List<MachineEntity>> all() async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_machines',
      orderBy: 'serial ASC',
    );
    return rows.map(_toEntity).toList(growable: false);
  }

  Future<void> clear() => _db.delete('cached_machines');

  MachineEntity _toEntity(Map<String, dynamic> row) {
    final Map<String, dynamic> json =
        jsonDecode(row['json'] as String) as Map<String, dynamic>;
    return MachineResponseModel.fromJson(json).toEntity();
  }
}
