import 'dart:convert';

import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/feature/users/data/models/branch_model.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:sqflite/sqflite.dart';

class CachedBranchesDao {
  const CachedBranchesDao(this._database);

  final AppDatabase _database;

  Database get _db => _database.db;

  /// Bootstrap/delta send the *whole* branch list every time (there is no
  /// per-branch delete signal), so a refresh replaces the table wholesale
  /// rather than trying to reconcile row by row.
  Future<void> replaceAll(List<Map<String, dynamic>> rows, {String? syncedAt}) async {
    final String synced = syncedAt ?? DateTime.now().toUtc().toIso8601String();

    await _db.transaction((Transaction txn) async {
      await txn.delete('cached_branches');

      final Batch batch = txn.batch();
      for (final Map<String, dynamic> json in rows) {
        batch.insert('cached_branches', <String, dynamic>{
          'id': json['id']?.toString() ?? '',
          'name': json['name'] as String? ?? '',
          'updated_at': synced,
          'synced_at': synced,
          'json': jsonEncode(json),
        });
      }
      await batch.commit(noResult: true);
    });
  }

  Future<List<BranchEntity>> all() async {
    final List<Map<String, dynamic>> rows = await _db.query('cached_branches', orderBy: 'name ASC');
    return rows
        .map((Map<String, dynamic> row) =>
            BranchModel.fromJson(jsonDecode(row['json'] as String) as Map<String, dynamic>)
                .toEntity())
        .toList(growable: false);
  }

  Future<void> clear() => _db.delete('cached_branches');
}
