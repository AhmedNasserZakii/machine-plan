import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/core/local_db/daos/pending_media_dao.dart';
import 'package:machinery/core/services/sync/pending_media_item.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'dart:io';

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late AppDatabase db;
  late PendingMediaDao dao;
  late String dbPath;

  setUp(() async {
    final dir = await Directory.systemTemp.createTemp('media_recover_test');
    dbPath = p.join(dir.path, 'test.db');
    db = await AppDatabase.open(path: dbPath);
    dao = PendingMediaDao(db);
  });

  tearDown(() async {
    await db.close();
    final file = File(dbPath);
    if (await file.exists()) await file.delete();
  });

  PendingMediaItem item(String id, MediaUploadState state) => PendingMediaItem(
        clientUuid: id,
        localPath: '/tmp/$id.jpg',
        purpose: 'SIGNATURE',
        mimeType: 'image/jpeg',
        sizeBytes: 12,
        checksum: 'abc',
        createdAt: DateTime.utc(2026, 9, 1),
        uploadState: state,
      );

  test('resetInterruptedUploads moves uploading rows back to staged', () async {
    await dao.insert(item('a', MediaUploadState.uploading));
    await dao.insert(item('b', MediaUploadState.staged));
    await dao.insert(item('c', MediaUploadState.uploaded));
    await dao.insert(item('d', MediaUploadState.failed));

    final changed = await dao.resetInterruptedUploads();
    expect(changed, 1);

    expect(
      (await dao.findByClientUuid('a'))!.uploadState,
      MediaUploadState.staged,
    );
    expect(
      (await dao.findByClientUuid('b'))!.uploadState,
      MediaUploadState.staged,
    );
    expect(
      (await dao.findByClientUuid('c'))!.uploadState,
      MediaUploadState.uploaded,
    );
    expect(
      (await dao.findByClientUuid('d'))!.uploadState,
      MediaUploadState.failed,
    );
  });

  test('notUploaded still returns previously interrupted uploads', () async {
    await dao.insert(item('x', MediaUploadState.uploading));
    await dao.resetInterruptedUploads();
    final pending = await dao.notUploaded();
    expect(pending.map((e) => e.clientUuid), contains('x'));
    expect(pending.single.uploadState, MediaUploadState.staged);
  });
}
