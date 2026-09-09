import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/entities/creatable_transfer_type.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';

/// Step one: what kind of hand-off, and to whom.
///
/// The list of types comes from the server, so a representative simply never
/// sees a company-warehouse dispatch — it is absent rather than disabled.
class TransferTypeStep extends StatelessWidget {
  const TransferTypeStep({required this.state, super.key});

  final CreateTransferState state;

  @override
  Widget build(BuildContext context) {
    if (state.isLoadingTypes) return const AppLoadingIndicator();

    if (state.availableTypes.isEmpty) {
      return AppEmptyState(
        icon: Icons.block_outlined,
        title: LocaleKeys.transferNoRecipients.tr(),
        subtitle: '',
      );
    }

    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();

    return ListView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      children: <Widget>[
        _SectionLabel(text: LocaleKeys.transferSelectType.tr()),
        const SizedBox(height: AppSpacing.sm),
        RadioGroup<String>(
          groupValue: state.selected?.type.value,
          onChanged: (String? value) => cubit.selectType(
            state.availableTypes.firstWhere(
              (CreatableTransferType option) => option.type.value == value,
            ),
          ),
          child: Column(
            children: state.availableTypes
                .map(
                  (CreatableTransferType option) => RadioListTile<String>(
                    value: option.type.value,
                    contentPadding: EdgeInsets.zero,
                    title: Text(TransferLabels.type(option.type)),
                    subtitle: option.selfAttested
                        ? Text(
                            LocaleKeys.transferSelfAttestedNote.tr(),
                            style: Styles.s12(
                              context,
                            ).copyWith(color: AppColors.textSecondaryColor),
                          )
                        : null,
                  ),
                )
                .toList(growable: false),
          ),
        ),
        if (state.selected != null) ...<Widget>[
          const SizedBox(height: AppSpacing.lg),
          _Receiver(state: state),
        ],
      ],
    );
  }
}

class _Receiver extends StatelessWidget {
  const _Receiver({required this.state});

  final CreateTransferState state;

  @override
  Widget build(BuildContext context) {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();
    final ReceiverKind kind = state.selected!.receiverKind;

    return switch (kind) {
      // Nobody to pick: the factory and the scrapyard are not records.
      ReceiverKind.none => _Note(
        text: LocaleKeys.transferNoRecipientNeeded.tr(),
      ),
      ReceiverKind.merchant => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _SectionLabel(text: LocaleKeys.transferSelectRecipient.tr()),
          const SizedBox(height: AppSpacing.sm),
          LabeledTextFormField(
            label: LocaleKeys.transferMerchantIdHint.tr(),
            hintText: LocaleKeys.transferMerchantIdHint.tr(),
            textDirection: TextDirection.ltr,
            identifier: 'transfer_merchant_field',
            onChanged: cubit.setMerchantId,
          ),
        ],
      ),
      _ => _RecipientPicker(state: state),
    };
  }
}

class _RecipientPicker extends StatelessWidget {
  const _RecipientPicker({required this.state});

  final CreateTransferState state;

  @override
  Widget build(BuildContext context) {
    if (state.isLoadingRecipients) return const AppLoadingIndicator();

    if (state.recipients.isEmpty) {
      return _Note(
        text: LocaleKeys.transferNoRecipients.tr(),
        color: AppColors.warningColor,
      );
    }

    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();
    final bool isWarehouse =
        state.selected!.receiverKind == ReceiverKind.warehouse;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _SectionLabel(
          text: isWarehouse
              ? LocaleKeys.transferSelectWarehouse.tr()
              : LocaleKeys.transferSelectRecipient.tr(),
        ),
        const SizedBox(height: AppSpacing.sm),
        RadioGroup<String>(
          groupValue: state.recipientId,
          onChanged: cubit.selectRecipient,
          child: Column(
            children: state.recipients
                .map(
                  (TransferRecipient recipient) => Semantics(
                    identifier: 'transfer_recipient_${recipient.id}',
                    child: RadioListTile<String>(
                      value: recipient.id,
                      contentPadding: EdgeInsets.zero,
                      title: Text(recipient.name),
                      subtitle: recipient.subtitle == null
                          ? null
                          : Text(recipient.subtitle!),
                    ),
                  ),
                )
                .toList(growable: false),
          ),
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Styles.s14(context).copyWith(
        fontWeight: FontWeight.w600,
        color: AppColors.textSecondaryColor,
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.text, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final Color resolved = color ?? AppColors.textSecondaryColor;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(Icons.info_outline_rounded, size: 16, color: resolved),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: Styles.s13(context).copyWith(color: resolved),
          ),
        ),
      ],
    );
  }
}
