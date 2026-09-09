import 'dart:convert';

import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/local_storage/local_storage_constant_keys.dart';
import 'package:machinery/core/services/sync/pending_sync_counter.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';

/// A durable FIFO for the only finance mutation the API declares replay-safe.
class FinanceSyncQueue implements PendingSyncCounter {
  const FinanceSyncQueue();

  List<TransactionDraft> all() {
    final List<String> rows =
        LocalStorage.local?.getStringList(
          StorageKeys.pendingFinanceTransactions,
        ) ??
        const <String>[];
    final List<TransactionDraft> drafts = <TransactionDraft>[];
    for (final String row in rows) {
      try {
        final Object? decoded = json.decode(row);
        if (decoded is Map<String, dynamic>) {
          drafts.add(TransactionDraft.fromJson(decoded));
        }
      } catch (_) {
        // A corrupt row must not hide every other valid pending transaction.
      }
    }
    return drafts;
  }

  Future<void> add(TransactionDraft draft) async {
    final List<String> rows =
        LocalStorage.local
            ?.getStringList(StorageKeys.pendingFinanceTransactions)
            ?.toList() ??
        <String>[];
    rows.add(json.encode(draft.toJson()));
    await LocalStorage.local?.setStringList(
      StorageKeys.pendingFinanceTransactions,
      rows,
    );
  }

  Future<void> remove(String clientUuid) async {
    final List<TransactionDraft> drafts = all()
        .where((TransactionDraft row) => row.clientUuid != clientUuid)
        .toList(growable: false);
    await LocalStorage.local?.setStringList(
      StorageKeys.pendingFinanceTransactions,
      drafts
          .map((TransactionDraft row) => json.encode(row.toJson()))
          .toList(growable: false),
    );
  }

  @override
  Future<int> pendingCount() async => all().length;
}
