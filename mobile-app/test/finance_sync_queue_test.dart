import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/services/sync/finance_sync_queue.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('finance queue persists replay-safe transaction drafts', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    LocalStorage.local = await SharedPreferences.getInstance();
    const queue = FinanceSyncQueue();
    const id = '12ce8e2c-17ce-4f91-a8d0-0b0d8499204a';
    await queue.add(
      TransactionDraft(
        kind: FinanceKind.expense,
        amount: 55.5,
        categoryId: 'category',
        transactionDate: DateTime(2026, 9, 8),
        paymentMethodId: 'cash',
        clientUuid: id,
      ),
    );
    expect(await queue.pendingCount(), 1);
    expect(queue.all().single.clientUuid, id);
    expect(queue.all().single.amount, 55.5);
    await queue.remove(id);
    expect(await queue.pendingCount(), 0);
  });
}
