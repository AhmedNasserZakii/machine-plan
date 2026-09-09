import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_cubit.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_state.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchants_query_params.dart';
import 'package:machinery/feature/merchants/presentation/widgets/merchant_card.dart';
import 'package:machinery/feature/merchants/presentation/widgets/merchants_filter_sheet.dart';

/// The book of trade: every shop a machine can be placed in.
class MerchantsListScreen extends StatefulWidget {
  const MerchantsListScreen({super.key});

  @override
  State<MerchantsListScreen> createState() => _MerchantsListScreenState();
}

class _MerchantsListScreenState extends State<MerchantsListScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<MerchantsListCubit>().load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openFilters(MerchantsListLoaded state) async {
    final MerchantsQueryParams? result = await MerchantsFilterSheet.show(
      context: context,
      branches: state.branches,
      current: state.query,
    );

    if (result == null || !mounted) {
      return;
    }

    await context.read<MerchantsListCubit>().applyFilters(result);
  }

  Future<void> _openDetail(MerchantEntity merchant) async {
    final bool? changed = await AppRoute.goToMerchantDetail(
      context: context,
      merchantId: merchant.id,
      initial: merchant,
    );

    if ((changed ?? false) && mounted) {
      await context.read<MerchantsListCubit>().load(showLoader: false);
    }
  }

  Future<void> _openForm() async {
    final bool? created = await AppRoute.goToMerchantForm(context: context);

    if ((created ?? false) && mounted) {
      await context.read<MerchantsListCubit>().load(showLoader: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(LocaleKeys.merchantsTitle.tr())),
      floatingActionButton: PermissionGate(
        permission: P.merchantsCreate,
        child: FloatingActionButton(
          heroTag: 'merchants_add_fab',
          onPressed: _openForm,
          child: Semantics(
            identifier: 'merchants_add_button',
            child: const Icon(Icons.add_rounded),
          ),
        ),
      ),
      body: BlocBuilder<MerchantsListCubit, MerchantsListState>(
        builder: (BuildContext context, MerchantsListState state) {
          return switch (state) {
            MerchantsListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<MerchantsListCubit>().load(),
              ),
            MerchantsListLoaded() => _buildList(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  /// True when the list is empty because of a search or filter rather than
  /// because nobody is registered — only one of those is the user's to fix.
  bool _isNarrowed(MerchantsListLoaded state) =>
      state.query.search != null || state.query.hasFilters;

  Widget _buildList(BuildContext context, MerchantsListLoaded state) {
    final MerchantsListCubit cubit = context.read<MerchantsListCubit>();

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: CustomSearchBar(
            controller: _searchController,
            identifier: 'merchants_search_field',
            hintText: LocaleKeys.merchantsSearchHint.tr(),
            hasActiveFilters: state.query.hasFilters,
            onChanged: cubit.search,
            onFilterPressed: () => _openFilters(state),
          ),
        ),
        Expanded(
          child: PaginatedListView<MerchantEntity>(
            items: state.merchants,
            hasNext: state.hasNext,
            isLoadingMore: state.isLoadingMore,
            onRefresh: () => cubit.load(showLoader: false),
            onLoadMore: cubit.loadMore,
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            emptyState: AppEmptyState(
              icon: Icons.storefront_outlined,
              title: _isNarrowed(state)
                  ? LocaleKeys.merchantsNoSearchResults.tr()
                  : LocaleKeys.merchantsEmptyTitle.tr(),
              subtitle: _isNarrowed(state)
                  ? ''
                  : LocaleKeys.merchantsEmptySubtitle.tr(),
            ),
            itemBuilder:
                (BuildContext context, MerchantEntity merchant, int index) {
                  return MerchantCard(
                    merchant: merchant,
                    onTap: () => _openDetail(merchant),
                  );
                },
          ),
        ),
      ],
    );
  }
}
