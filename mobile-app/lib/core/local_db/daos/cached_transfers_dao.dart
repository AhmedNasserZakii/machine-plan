import 'dart:convert';

import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/feature/transfers/data/models/transfer_response_model.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:sqflite/sqflite.dart';

/// The local mirror of `pendingTransfers` — the hand-offs waiting on this
/// user's signature, downloaded fully (items, photos, signatures already
/// taken) so confirming one needs no connection (`07`).
class CachedTransfersDao {
  const CachedTransfersDao(this._database);

  final AppDatabase _database;

  Database get _db => _database.db;

  Future<void> upsertAll(List<Map<String, dynamic>> rows, {String? syncedAt}) async {
    if (rows.isEmpty) return;

    final String synced = syncedAt ?? DateTime.now().toUtc().toIso8601String();
    final Batch batch = _db.batch();

    for (final Map<String, dynamic> json in rows) {
      batch.insert(
        'cached_transfers',
        <String, dynamic>{
          'id': json['id']?.toString() ?? '',
          'status': json['status'] as String? ?? '',
          'occurred_at': json['occurredAt'] as String? ?? synced,
          'updated_at': json['confirmedAt'] as String? ?? json['occurredAt'] as String? ?? synced,
          'synced_at': synced,
          'json': jsonEncode(json),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }

    await batch.commit(noResult: true);
  }

  Future<void> upsertOne(Map<String, dynamic> json) => upsertAll(<Map<String, dynamic>>[json]);

  Future<void> deleteByIds(List<String> ids) async {
    if (ids.isEmpty) return;
    final String placeholders = List.filled(ids.length, '?').join(',');
    await _db.delete('cached_transfers', where: 'id IN ($placeholders)', whereArgs: ids);
  }

  Future<TransferEntity?> findById(String id) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_transfers',
      where: 'id = ?',
      whereArgs: <String>[id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _toEntity(rows.first);
  }

  Future<List<TransferEntity>> byStatus(String status) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_transfers',
      where: 'status = ?',
      whereArgs: <String>[status],
      orderBy: 'occurred_at DESC',
    );
    return rows.map(_toEntity).toList(growable: false);
  }

  Future<List<TransferEntity>> all() async {
    final List<Map<String, dynamic>> rows =
        await _db.query('cached_transfers', orderBy: 'occurred_at DESC');
    return rows.map(_toEntity).toList(growable: false);
  }

  Future<void> clear() => _db.delete('cached_transfers');

  TransferEntity _toEntity(Map<String, dynamic> row) {
    final Map<String, dynamic> json = jsonDecode(row['json'] as String) as Map<String, dynamic>;
    return TransferResponseModel.fromJson(json).toEntity();
  }
}
