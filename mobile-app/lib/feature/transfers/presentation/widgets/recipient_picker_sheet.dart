import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';

/// Searchable, offset-paginated recipient list for the transfer wizard.
/// Copied from [MachinePickerSheet]: debounce lives on the cubit, the sheet
/// only renders [PaginatedListView].
class RecipientPickerSheet extends StatefulWidget {
  const RecipientPickerSheet({required this.isWarehouse, super.key});

  final bool isWarehouse;

  static Future<void> show({
    required BuildContext context,
    required CreateTransferCubit cubit,
    required bool isWarehouse,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => BlocProvider<CreateTransferCubit>.value(
        value: cubit,
        child: RecipientPickerSheet(isWarehouse: isWarehouse),
      ),
    );
  }

  @override
  State<RecipientPickerSheet> createState() => _RecipientPickerSheetState();
}

class _RecipientPickerSheetState extends State<RecipientPickerSheet> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<CreateTransferCubit>().loadRecipients();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();

    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.88,
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      widget.isWarehouse
                          ? LocaleKeys.transferSelectWarehouse.tr()
                          : LocaleKeys.transferSelectRecipient.tr(),
                      style: Styles.s17(context),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
              ),
              child: CustomSearchBar(
                controller: _searchController,
                identifier: 'transfer_recipient_search_field',
                hintText: LocaleKeys.transferPickerSearchHint.tr(),
                onChanged: cubit.searchRecipients,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: BlocBuilder<CreateTransferCubit, CreateTransferState>(
                builder: (BuildContext context, CreateTransferState state) {
                  if (state.isLoadingRecipients && state.recipients.isEmpty) {
                    return const AppLoadingIndicator();
                  }

                  return PaginatedListView<TransferRecipient>(
                    items: state.recipients,
                    hasNext: state.recipientsHasNext,
                    isLoadingMore: state.isLoadingMoreRecipients,
                    onRefresh: () => cubit.loadRecipients(showLoader: false),
                    onLoadMore: cubit.loadMoreRecipients,
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      AppSpacing.md,
                      0,
                      AppSpacing.md,
                      AppSpacing.md,
                    ),
                    emptyState: AppEmptyState(
                      icon: Icons.person_search_outlined,
                      title: LocaleKeys.transferNoRecipients.tr(),
                      subtitle: '',
                    ),
                    itemBuilder:
                        (
                          BuildContext context,
                          TransferRecipient recipient,
                          int _,
                        ) {
                      final bool selected = state.recipientId == recipient.id;
                      return ListTile(
                        selected: selected,
                        contentPadding: EdgeInsets.zero,
                        title: Text(recipient.name),
                        subtitle: recipient.subtitle == null
                            ? null
                            : Text(recipient.subtitle!),
                        trailing: selected
                            ? const Icon(Icons.check_rounded)
                            : null,
                        onTap: () {
                          cubit.selectRecipient(recipient);
                          Navigator.of(context).pop();
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
