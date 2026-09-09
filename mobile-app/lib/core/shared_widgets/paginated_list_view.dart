import 'package:flutter/material.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';

/// The one list implementation: pull-to-refresh, infinite scroll at 80% of the
/// extent, an inline bottom loader, and slots for the empty and error states.
/// Feature screens must not reimplement pagination.
class PaginatedListView<T> extends StatefulWidget {
  const PaginatedListView({
    required this.items,
    required this.itemBuilder,
    required this.hasNext,
    required this.isLoadingMore,
    required this.onRefresh,
    required this.onLoadMore,
    super.key,
    this.emptyState,
    this.separator,
    this.padding,
    this.header,
    this.physics,
  });

  final List<T> items;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final bool hasNext;
  final bool isLoadingMore;
  final Future<void> Function() onRefresh;
  final VoidCallback onLoadMore;
  final Widget? emptyState;
  final Widget? separator;
  final EdgeInsetsGeometry? padding;
  final Widget? header;
  final ScrollPhysics? physics;

  @override
  State<PaginatedListView<T>> createState() => _PaginatedListViewState<T>();
}

class _PaginatedListViewState<T> extends State<PaginatedListView<T>> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!widget.hasNext || widget.isLoadingMore) {
      return;
    }

    final ScrollPosition position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent * 0.8) {
      widget.onLoadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty && widget.emptyState != null) {
      return RefreshIndicator(
        color: AppColors.primaryColor,
        onRefresh: widget.onRefresh,
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: widget.emptyState,
            ),
          ),
        ),
      );
    }

    final int headerCount = widget.header != null ? 1 : 0;
    final int footerCount = widget.isLoadingMore ? 1 : 0;

    return RefreshIndicator(
      color: AppColors.primaryColor,
      onRefresh: widget.onRefresh,
      child: ListView.separated(
        controller: _scrollController,
        physics: widget.physics ?? const AlwaysScrollableScrollPhysics(),
        padding:
            widget.padding ?? const EdgeInsetsDirectional.all(AppSpacing.md),
        itemCount: widget.items.length + headerCount + footerCount,
        separatorBuilder: (_, _) =>
            widget.separator ?? const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          if (widget.header != null && index == 0) {
            return widget.header!;
          }

          final int itemIndex = index - headerCount;

          if (itemIndex >= widget.items.length) {
            return const Padding(
              padding: EdgeInsetsDirectional.all(AppSpacing.md),
              child: AppLoadingIndicator(size: 28),
            );
          }

          return widget.itemBuilder(
            context,
            widget.items[itemIndex],
            itemIndex,
          );
        },
      ),
    );
  }
}
