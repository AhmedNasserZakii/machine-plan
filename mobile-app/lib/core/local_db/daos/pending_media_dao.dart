import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/core/services/sync/pending_media_item.dart';
import 'package:sqflite/sqflite.dart';

class PendingMediaDao {
  const PendingMediaDao(this._database);

  final AppDatabase _database;

  Database get _db => _database.db;

  Future<void> insert(PendingMediaItem item) async {
    await _db.insert(
      'pending_media',
      item.toRow(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> update(PendingMediaItem item) async {
    await _db.update(
      'pending_media',
      item.toRow(),
      where: 'client_uuid = ?',
      whereArgs: <String>[item.clientUuid],
    );
  }

  Future<void> delete(String clientUuid) async {
    await _db.delete('pending_media', where: 'client_uuid = ?', whereArgs: <String>[clientUuid]);
  }

  Future<PendingMediaItem?> findByClientUuid(String clientUuid) async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'pending_media',
      where: 'client_uuid = ?',
      whereArgs: <String>[clientUuid],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return PendingMediaItem.fromRow(rows.first);
  }

  Future<List<PendingMediaItem>> findByClientUuids(List<String> clientUuids) async {
    if (clientUuids.isEmpty) return const <PendingMediaItem>[];
    final String placeholders = List.filled(clientUuids.length, '?').join(',');
    final List<Map<String, dynamic>> rows = await _db.query(
      'pending_media',
      where: 'client_uuid IN ($placeholders)',
      whereArgs: clientUuids,
    );
    return rows.map(PendingMediaItem.fromRow).toList(growable: false);
  }

  Future<List<PendingMediaItem>> notUploaded() async {
    final List<Map<String, dynamic>> rows = await _db.query(
      'pending_media',
      where: 'upload_state != ?',
      whereArgs: <String>['uploaded'],
      orderBy: 'created_at ASC',
    );
    return rows.map(PendingMediaItem.fromRow).toList(growable: false);
  }

  Future<List<PendingMediaItem>> all() async {
    final List<Map<String, dynamic>> rows =
        await _db.query('pending_media', orderBy: 'created_at ASC');
    return rows.map(PendingMediaItem.fromRow).toList(growable: false);
  }

  Future<void> clear() => _db.delete('pending_media');
}
