import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/entities/creatable_transfer_type.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';

/// `needsSenderSignature` and `recipientDisplayName` are what the signing
/// screen (`9.3`) reads to decide whether to show a signature pad at all, and
/// what to put in its "المستلم" row — worth pinning down directly rather than
/// only through the wizard's widgets.
void main() {
  const CreatableTransferType selfAttestedToMerchant = CreatableTransferType(
    type: TransferType.representativeToMerchant,
    receiverKind: ReceiverKind.merchant,
    selfAttested: true,
  );

  const CreatableTransferType plainToBranch = CreatableTransferType(
    type: TransferType.representativeToBranch,
    receiverKind: ReceiverKind.user,
    selfAttested: false,
  );

  test('needsSenderSignature follows selfAttested on the selected type', () {
    const CreateTransferState selfAttested = CreateTransferState(
      clientUuid: 'c1',
      selected: selfAttestedToMerchant,
    );
    const CreateTransferState plain = CreateTransferState(
      clientUuid: 'c1',
      selected: plainToBranch,
    );
    const CreateTransferState none = CreateTransferState(clientUuid: 'c1');

    expect(selfAttested.needsSenderSignature, isTrue);
    expect(plain.needsSenderSignature, isFalse);
    expect(none.needsSenderSignature, isFalse);
  });

  test(
    'recipientDisplayName prefers the merchant name over the bare id',
    () {
      const CreateTransferState named = CreateTransferState(
        clientUuid: 'c1',
        selected: selfAttestedToMerchant,
        merchantId: 'm-1',
        merchantName: 'محل الاختبار',
      );
      const CreateTransferState unnamed = CreateTransferState(
        clientUuid: 'c1',
        selected: selfAttestedToMerchant,
        merchantId: 'm-1',
      );

      expect(named.recipientDisplayName, 'محل الاختبار');
      expect(unnamed.recipientDisplayName, 'm-1');
    },
  );

  test(
    'recipientDisplayName resolves a user/warehouse receiver from the recipients list',
    () {
      const CreateTransferState state = CreateTransferState(
        clientUuid: 'c1',
        selected: plainToBranch,
        recipients: <TransferRecipient>[
          TransferRecipient(id: 'r-1', name: 'مشرف فرع القاهرة'),
        ],
        recipientId: 'r-1',
      );

      expect(state.recipientDisplayName, 'مشرف فرع القاهرة');
    },
  );

  test('recipientDisplayName is null when nothing has been picked yet', () {
    const CreateTransferState state = CreateTransferState(
      clientUuid: 'c1',
      selected: plainToBranch,
    );

    expect(state.recipientDisplayName, isNull);
  });
}
