import 'dart:convert';

import 'package:machinery/core/local_db/app_database.dart';
import 'package:sqflite/sqflite.dart';

/// One table for every small, rarely-changing reference list the bootstrap
/// carries (`07`): machine types/models, payment methods, violation types,
/// maintenance locations, decommission reasons, finance categories.
///
/// Deliberately returns raw JSON rather than a parsed entity — each category
/// already has its own model/parser in its own feature (`MachineTypeModel`,
/// `LookupEntity`, …); duplicating seven parsers here just to hand back a
/// typed list would be the DAO reaching into every feature's domain layer.
/// Callers parse with whatever they already use for that category's REST
/// endpoint — the JSON shape is identical either way.
class CachedLookupsDao {
  const CachedLookupsDao(this._database);

  final AppDatabase _database;

  Database get _db => _database.db;

  static const String machineTypes = 'machineTypes';
  static const String machineModels = 'machineModels';
  static const String paymentMethods = 'paymentMethods';
  static const String violationTypes = 'violationTypes';
  static const String maintenanceLocations = 'maintenanceLocations';
  static const String decommissionReasons = 'decommissionReasons';
  static const String financeCategories = 'financeCategories';

  Future<void> replaceCategory(String category, List<Map<String, dynamic>> rows) async {
    final String synced = DateTime.now().toUtc().toIso8601String();

    await _db.transaction((Transaction txn) async {
      await txn.delete('cached_lookups', where: 'category = ?', whereArgs: <String>[category]);

      final Batch batch = txn.batch();
      for (int index = 0; index < rows.length; index++) {
        final Map<String, dynamic> json = rows[index];
        batch.insert('cached_lookups', <String, dynamic>{
          'category': category,
          'id': json['id']?.toString() ?? index.toString(),
          'sort_order': (json['sortOrder'] as num?)?.toInt() ?? index,
          'synced_at': synced,
          'json': jsonEncode(json),
        });
      }
      await batch.commit(noResult: true);
    });
  }

  Future<List<Map<String, dynamic>>> byCategory(String category) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'cached_lookups',
      where: 'category = ?',
      whereArgs: <String>[category],
      orderBy: 'sort_order ASC',
    );
    return rows
        .map((Map<String, dynamic> row) => jsonDecode(row['json'] as String) as Map<String, dynamic>)
        .toList(growable: false);
  }

  Future<void> clear() => _db.delete('cached_lookups');
}
