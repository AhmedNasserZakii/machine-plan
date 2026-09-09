import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/data/logic/machine_timeline/machine_timeline_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_timeline/machine_timeline_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_timeline_event.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_timeline_labels.dart';

/// The whole life story of one machine, newest first (`8.1`). Backed by the
/// server's keyset-paginated `GET /machines/:id/timeline`, distinct from the
/// merchant detail's embedded, unpaginated timeline card — a fleet unit can
/// accumulate far more events than a merchant ever does.
class MachineTimelineScreen extends StatefulWidget {
  const MachineTimelineScreen({super.key});

  @override
  State<MachineTimelineScreen> createState() => _MachineTimelineScreenState();
}

class _MachineTimelineScreenState extends State<MachineTimelineScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MachineTimelineCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.machineTimelineTitle.tr()),
      ),
      body: BlocBuilder<MachineTimelineCubit, MachineTimelineState>(
        builder: (BuildContext context, MachineTimelineState state) {
          return switch (state) {
            MachineTimelineFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<MachineTimelineCubit>().load(),
              ),
            MachineTimelineLoaded() => _buildList(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildList(BuildContext context, MachineTimelineLoaded state) {
    final MachineTimelineCubit cubit = context.read<MachineTimelineCubit>();

    return PaginatedListView<MachineTimelineEvent>(
      items: state.events,
      hasNext: state.hasNext,
      isLoadingMore: state.isLoadingMore,
      onRefresh: cubit.load,
      onLoadMore: cubit.loadMore,
      emptyState: AppEmptyState(
        icon: Icons.history_rounded,
        title: LocaleKeys.machineTimelineEmpty.tr(),
        subtitle: '',
      ),
      itemBuilder: (BuildContext context, MachineTimelineEvent event, int _) {
        return _TimelineTile(event: event);
      },
    );
  }
}

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({required this.event});

  final MachineTimelineEvent event;

  @override
  Widget build(BuildContext context) {
    final Color color = MachineTimelineLabels.color(event.type);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          CircleAvatar(
            radius: 16,
            backgroundColor: color.withValues(alpha: 0.12),
            child: Icon(
              MachineTimelineLabels.icon(event.type),
              size: 16,
              color: color,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  MachineTimelineLabels.title(event.type),
                  style: Styles.s14(
                    context,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  Formatters.dateTime(event.at),
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
                if (event.refNo != null) ...<Widget>[
                  const SizedBox(height: 2),
                  LtrText(
                    event.refNo!,
                    style: Styles.s12(
                      context,
                    ).copyWith(color: AppColors.textSecondaryColor),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
