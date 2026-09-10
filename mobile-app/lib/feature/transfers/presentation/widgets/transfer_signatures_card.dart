import 'package:cached_network_image/cached_network_image.dart';
import 'package:dartz/dartz.dart' hide State;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

/// Who signed, as what, and when. This is the record that replaces the paper
/// receipt, so it is shown even when there is only one signature on it.
class TransferSignaturesCard extends StatelessWidget {
  const TransferSignaturesCard({
    required this.transferId,
    required this.signatures,
    super.key,
  });

  final String transferId;
  final List<TransferSignatureEntity> signatures;

  @override
  Widget build(BuildContext context) {
    if (signatures.isEmpty) return const SizedBox.shrink();

    return DetailCard(
      title: LocaleKeys.transferSignaturesTitle.tr(),
      icon: Icons.draw_outlined,
      children: signatures
          .map(
            (TransferSignatureEntity signature) => _SignatureRow(
              transferId: transferId,
              signature: signature,
            ),
          )
          .toList(growable: false),
    );
  }
}

class _SignatureRow extends StatelessWidget {
  const _SignatureRow({required this.transferId, required this.signature});

  final String transferId;
  final TransferSignatureEntity signature;

  @override
  Widget build(BuildContext context) {
    final bool hasImage =
        signature.method == SignatureMethod.drawn &&
        signature.signatureMediaId != null &&
        signature.id.isNotEmpty;

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (hasImage)
            _SignatureThumbnail(transferId: transferId, signature: signature)
          else
            const Padding(
              padding: EdgeInsetsDirectional.only(top: 2),
              child: Icon(
                Icons.fingerprint,
                size: 20,
                color: AppColors.successColor,
              ),
            ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  LocaleKeys.transferSignedBy.tr(
                    args: <String>[
                      signature.userFullName ??
                          TransferLabels.signatureRole(signature.partyRole),
                    ],
                  ),
                  style: Styles.s13(
                    context,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${TransferLabels.signatureRole(signature.partyRole)} — '
                  '${Formatters.dateTime(signature.signedAt)}',
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
                if (signature.deviceModel != null)
                  Text(
                    LocaleKeys.transferSignatureDevice.tr(
                      args: <String>[signature.deviceModel!],
                    ),
                    style: Styles.s12(
                      context,
                    ).copyWith(color: AppColors.textSecondaryColor),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A small tappable preview of a drawn signature. Fetched lazily and once per
/// row — the URL is short-lived, so the full viewer re-fetches its own rather
/// than reusing whatever this happened to resolve.
class _SignatureThumbnail extends StatefulWidget {
  const _SignatureThumbnail({required this.transferId, required this.signature});

  final String transferId;
  final TransferSignatureEntity signature;

  @override
  State<_SignatureThumbnail> createState() => _SignatureThumbnailState();
}

class _SignatureThumbnailState extends State<_SignatureThumbnail> {
  late final Future<Either<ServerFailure, String>> _future = getIt<TransfersRepo>()
      .fetchSignatureMediaUrl(
        transferId: widget.transferId,
        signatureId: widget.signature.id,
      );

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _open,
      child: Container(
        width: 40,
        height: 40,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.borderColor),
          borderRadius: BorderRadius.circular(6),
          color: Colors.white,
        ),
        child: FutureBuilder<Either<ServerFailure, String>>(
          future: _future,
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return const Center(
                child: SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              );
            }

            return snapshot.data!.fold(
              (ServerFailure failure) => const Icon(
                Icons.broken_image_outlined,
                size: 16,
                color: AppColors.textSecondaryColor,
              ),
              (String url) => CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.contain,
                errorWidget: (_, _, _) => const Icon(
                  Icons.broken_image_outlined,
                  size: 16,
                  color: AppColors.textSecondaryColor,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  void _open() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _SignatureViewerPage(
          transferId: widget.transferId,
          signatureId: widget.signature.id,
        ),
      ),
    );
  }
}

/// A protected, full-size look at one signature. No save or share affordance
/// on purpose — this is evidence, not a photo the app hands out.
class _SignatureViewerPage extends StatelessWidget {
  const _SignatureViewerPage({
    required this.transferId,
    required this.signatureId,
  });

  final String transferId;
  final String signatureId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(LocaleKeys.transferSignatureViewerTitle.tr()),
      ),
      body: FutureBuilder<Either<ServerFailure, String>>(
        future: getIt<TransfersRepo>().fetchSignatureMediaUrl(
          transferId: transferId,
          signatureId: signatureId,
        ),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          return snapshot.data!.fold(
            (ServerFailure failure) => Center(
              child: Text(
                LocaleKeys.transferSignatureImageFailed.tr(),
                style: const TextStyle(color: Colors.white),
              ),
            ),
            (String url) => Center(
              child: InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.contain,
                  errorWidget: (_, _, _) => Text(
                    LocaleKeys.transferSignatureImageFailed.tr(),
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
