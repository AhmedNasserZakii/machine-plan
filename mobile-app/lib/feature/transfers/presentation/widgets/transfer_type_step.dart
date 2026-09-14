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
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/entities/creatable_transfer_type.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';
import 'package:machinery/feature/transfers/presentation/widgets/recipient_picker_sheet.dart';

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
    final ReceiverKind kind = state.selected!.receiverKind;

    return switch (kind) {
      // Nobody to pick: the factory and the scrapyard are not records.
      ReceiverKind.none => _Note(
        text: LocaleKeys.transferNoRecipientNeeded.tr(),
      ),
      ReceiverKind.merchant => const _MerchantRecipientField(),
      _ => _RecipientPicker(state: state),
    };
  }
}

class _RecipientPicker extends StatelessWidget {
  const _RecipientPicker({required this.state});

  final CreateTransferState state;

  @override
  Widget build(BuildContext context) {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();
    final bool isWarehouse =
        state.selected!.receiverKind == ReceiverKind.warehouse;
    final String? selectedName = state.recipientDisplayName;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _SectionLabel(
          text: isWarehouse
              ? LocaleKeys.transferSelectWarehouse.tr()
              : LocaleKeys.transferSelectRecipient.tr(),
        ),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton(
          onPressed: () => RecipientPickerSheet.show(
            context: context,
            cubit: cubit,
            isWarehouse: isWarehouse,
          ),
          child: Semantics(
            identifier: 'transfer_recipient_picker_button',
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(
                selectedName ??
                    (isWarehouse
                        ? LocaleKeys.transferSelectWarehouse.tr()
                        : LocaleKeys.transferSelectRecipient.tr()),
              ),
            ),
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

/// The merchant recipient step (`9.1`).
///
/// A merchant has no login, so picking one from a list the representative
/// cannot always search efficiently is not the common case — a shop he just
/// registered is. The typed code stays as the fallback for an existing shop;
/// "تاجر جديد" is the shortcut for the shop that does not exist yet, routing
/// to the merchant form and coming back with the created record instead of a
/// bare id the representative would otherwise have to copy by hand.
class _MerchantRecipientField extends StatefulWidget {
  const _MerchantRecipientField();

  @override
  State<_MerchantRecipientField> createState() =>
      _MerchantRecipientFieldState();
}

class _MerchantRecipientFieldState extends State<_MerchantRecipientField> {
  late final TextEditingController _controller;
  String? _selectedShopName;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: context.read<CreateTransferCubit>().state.merchantId ?? '',
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _createMerchant() async {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();

    final MerchantEntity? created = await AppRoute.goToMerchantForm(
      context: context,
    );

    if (created == null || !mounted) return;

    cubit.setMerchantId(created.id, name: created.shopName);
    _controller.text = created.id;
    setState(() => _selectedShopName = created.shopName);
  }

  void _onTyped(String value) {
    if (_selectedShopName != null) {
      setState(() => _selectedShopName = null);
    }
    context.read<CreateTransferCubit>().setMerchantId(value);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _SectionLabel(text: LocaleKeys.transferSelectRecipient.tr()),
        const SizedBox(height: AppSpacing.sm),
        if (_selectedShopName != null)
          Container(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.surfaceColor,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.borderColor),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    LocaleKeys.transferMerchantSelected.tr(
                      args: [_selectedShopName!],
                    ),
                    style: Styles.s14(context),
                  ),
                ),
                TextButton(
                  onPressed: _createMerchant,
                  child: Text(LocaleKeys.transferMerchantChange.tr()),
                ),
              ],
            ),
          )
        else ...<Widget>[
          LabeledTextFormField(
            label: LocaleKeys.transferMerchantIdHint.tr(),
            hintText: LocaleKeys.transferMerchantIdHint.tr(),
            controller: _controller,
            textDirection: TextDirection.ltr,
            identifier: 'transfer_merchant_field',
            onChanged: _onTyped,
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              onPressed: _createMerchant,
              icon: const Icon(Icons.add_business_rounded, size: 18),
              label: Semantics(
                identifier: 'transfer_new_merchant_button',
                child: Text(LocaleKeys.transferNewMerchant.tr()),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Icon(
          Icons.info_outline_rounded,
          size: 16,
          color: AppColors.textSecondaryColor,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: Styles.s13(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ),
      ],
    );
  }
}
