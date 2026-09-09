import 'dart:convert';

import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/feature/merchants/data/models/merchant_response_model.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:sqflite/sqflite.dart';

class CachedMerchantsDao {
  const CachedMerchantsDao(this._database);

  final AppDatabase _database;

  Database get _db => _database.db;

  Future<void> upsertAll(List<Map<String, dynamic>> rows, {String? syncedAt}) async {
    if (rows.isEmpty) return;

    final String synced = syncedAt ?? DateTime.now().toUtc().toIso8601String();
    final Batch batch = _db.batch();

    for (final Map<String, dynamic> json in rows) {
      batch.insert(
        'cached_merchants',
        <String, dynamic>{
          'id': json['id']?.toString() ?? '',
          'name': json['name'] as String? ?? '',
          'phone': json['phone'] as String? ?? '',
          'shop_name': json['shopName'] as String? ?? '',
          'updated_at': json['createdAt'] as String? ?? synced,
          'synced_at': synced,
          'json': jsonEncode(json),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }

    await batch.commit(noResult: true);
  }

  /// Merges one freshly-created-offline row into the cache immediately, so the
  /// merchant picker shows it before the queue has had a chance to sync it.
  Future<void> upsertOne(Map<String, dynamic> json) => upsertAll(<Map<String, dynamic>>[json]);

  Future<void> deleteByIds(List<String> ids) async {
    if (ids.isEmpty) return;
    final String placeholders = List.filled(ids.length, '?').join(',');
    await _db.delete('cached_merchants', where: 'id IN ($placeholders)', whereArgs: ids);
  }

  Future<MerchantEntity?> findById(String id) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_merchants',
      where: 'id = ?',
      whereArgs: <String>[id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _toEntity(rows.first);
  }

  Future<List<MerchantEntity>> search({String? query, int limit = 100}) async {
    final String? trimmed = query?.trim();

    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_merchants',
      where: trimmed == null || trimmed.isEmpty
          ? null
          : '(name LIKE ? OR phone LIKE ? OR shop_name LIKE ?)',
      whereArgs: trimmed == null || trimmed.isEmpty
          ? null
          : <String>['%$trimmed%', '%$trimmed%', '%$trimmed%'],
      orderBy: 'name ASC',
      limit: limit,
    );
    return rows.map(_toEntity).toList(growable: false);
  }

  Future<List<MerchantEntity>> all() async {
    final List<Map<String, dynamic>> rows = await _db.query('cached_merchants', orderBy: 'name ASC');
    return rows.map(_toEntity).toList(growable: false);
  }

  Future<void> clear() => _db.delete('cached_merchants');

  MerchantEntity _toEntity(Map<String, dynamic> row) {
    final Map<String, dynamic> json = jsonDecode(row['json'] as String) as Map<String, dynamic>;
    return MerchantResponseModel.fromJson(json).toEntity();
  }
}
