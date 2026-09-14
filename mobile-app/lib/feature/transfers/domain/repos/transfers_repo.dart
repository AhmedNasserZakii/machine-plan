import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/domain/entities/creatable_transfer_type.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';

class TransfersPage {
  const TransfersPage({required this.transfers, required this.meta});

  final List<TransferEntity> transfers;
  final PaginationMetaModel meta;
}

class TransferRecipientsPage {
  const TransferRecipientsPage({
    required this.recipients,
    required this.meta,
  });

  final List<TransferRecipient> recipients;
  final PaginationMetaModel meta;
}

/// What a dry run reports back, so the create wizard can stop a hand-off before
/// the representative has collected a signature for it.
class TransferValidation {
  const TransferValidation({required this.valid, required this.problems});

  final bool valid;
  final List<String> problems;
}

abstract class TransfersRepo {
  Future<Either<ServerFailure, TransfersPage>> fetchTransfers({
    required TransfersQueryParams params,
  });

  Future<Either<ServerFailure, TransferEntity>> fetchTransfer({
    required String id,
  });

  /// Runs every create check without writing. Called before the signature step,
  /// not after.
  Future<Either<ServerFailure, TransferValidation>> validate({
    required CreateTransferParams params,
  });

  Future<Either<ServerFailure, TransferEntity>> createTransfer({
    required CreateTransferParams params,
  });

  Future<Either<ServerFailure, TransferEntity>> confirmTransfer({
    required String id,
    required ConfirmTransferParams params,
  });

  Future<Either<ServerFailure, TransferEntity>> rejectTransfer({
    required String id,
    required String reason,
  });

  Future<Either<ServerFailure, TransferEntity>> cancelTransfer({
    required String id,
    String? reason,
  });

  /// Uploads a drawn signature and returns the confirmed media id to attach to
  /// it. Three round trips — reserve, upload, confirm — so the bytes never pass
  /// through the API server.
  Future<Either<ServerFailure, String>> uploadSignature({
    required Uint8List png,
  });

  /// Same handshake for hand-off condition photos, which are JPEGs.
  Future<Either<ServerFailure, String>> uploadItemPhoto({
    required Uint8List jpeg,
  });

  /// A short-lived, viewable URL for one signature's drawn image — authorized
  /// by being able to read this transfer, not by having uploaded the media, so
  /// this works for the transfer's other party too.
  Future<Either<ServerFailure, String>> fetchSignatureMediaUrl({
    required String transferId,
    required String signatureId,
  });

  /// Which hand-offs the signed-in user may start.
  Future<Either<ServerFailure, List<CreatableTransferType>>>
  fetchCreatableTypes();

  /// Who this caller may hand a given type to — supervisors for a branch
  /// dispatch, warehouses for a return, nobody at all for a scrapping. The
  /// server applies the same-branch rule, so a supervisor is never offered
  /// another branch's representative only to be refused on submit.
  Future<Either<ServerFailure, TransferRecipientsPage>> fetchRecipients({
    required TransferType type,
    int page = 1,
    String? search,
  });
}

/// A pickable receiver, flattened to what the picker actually shows. Users and
/// warehouses arrive from different endpoints but read identically here.
class TransferRecipient {
  const TransferRecipient({
    required this.id,
    required this.name,
    this.subtitle,
  });

  final String id;
  final String name;

  /// The branch, or the phone number — whatever tells two same-named people
  /// apart in a list.
  final String? subtitle;
}
