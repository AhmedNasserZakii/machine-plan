import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/presentation/helpers/transfer_labels.dart';
import 'package:machinery/feature/users/domain/entities/user_custody_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/user_avatar.dart';
import 'package:machinery/feature/users/presentation/widgets/user_role_chip.dart';
import 'package:machinery/feature/users/presentation/widgets/user_status_chip.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';

class UserDetailHeader extends StatelessWidget {
  const UserDetailHeader({required this.user, super.key});
  final UserEntity user;
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: Row(
            children: <Widget>[
              UserAvatar(fullName: user.fullName),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(user.fullName,
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      children: <Widget>[
                        UserRoleChip(roleName: user.roleName),
                        UserStatusChip(isActive: user.isActive),
                      ],
                    ),
                    if (user.branchName != null) Text(user.branchName!),
                    Text(user.phone, textDirection: TextDirection.ltr),
                    if (user.email != null) Text(user.email!),
                    Text(
                      user.lastLoginAt == null
                          ? LocaleKeys.userNeverSignedIn.tr()
                          : '${LocaleKeys.userLastLogin.tr()}: ${Formatters.dateTime(user.lastLoginAt!)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}

class UserCustodySection extends StatelessWidget {
  const UserCustodySection({required this.custody, super.key});
  final UserCustodyEntity custody;
  @override
  Widget build(BuildContext context) => _SectionCard(
        title: LocaleKeys.userCustodyTitle.tr(),
        icon: Icons.precision_manufacturing_outlined,
        children: <Widget>[
          _Metrics(values: <String, String>{
            LocaleKeys.userCustodyTotal.tr():
                custody.summary.totalMachines.toString(),
            LocaleKeys.userCustodyInHand.tr():
                custody.summary.inHand.toString(),
            LocaleKeys.userCustodyAtMerchants.tr():
                custody.summary.withMerchants.toString(),
          }),
          ...custody.machines.take(3).map(
                (machine) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(machine.serial, textDirection: TextDirection.ltr),
                  subtitle: Text(machine.merchantName ?? machine.model),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => AppRoute.goToMachineDetail(
                    context: context,
                    machineId: machine.id,
                  ),
                ),
              ),
        ],
      );
}

class UserViolationsSection extends StatelessWidget {
  const UserViolationsSection({required this.summary, super.key});
  final ViolationSummary summary;
  @override
  Widget build(BuildContext context) => _SectionCard(
        title: LocaleKeys.userViolationsTitle.tr(),
        icon: Icons.gavel_outlined,
        children: <Widget>[
          _Metrics(values: <String, String>{
            LocaleKeys.userViolationsOpen.tr(): summary.totals.open.toString(),
            LocaleKeys.userViolationsAll.tr(): summary.totals.all.toString(),
            LocaleKeys.userViolationsCharged.tr():
                Formatters.currency(summary.totalCharged),
          }),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(LocaleKeys.userViolationsTrend.tr()),
            trailing: Text(summary.trend.name.toUpperCase()),
          ),
        ],
      );
}

class UserActivitySection extends StatelessWidget {
  const UserActivitySection({required this.activity, super.key});
  final List<TransferEntity> activity;
  @override
  Widget build(BuildContext context) => _SectionCard(
        title: LocaleKeys.userActivityTitle.tr(),
        icon: Icons.history,
        children: activity.isEmpty
            ? <Widget>[Text(LocaleKeys.userActivityEmpty.tr())]
            : activity
                .map((transfer) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(transfer.referenceNo,
                          textDirection: TextDirection.ltr),
                      subtitle: Text(
                          '${TransferLabels.type(transfer.type)} • ${Formatters.date(transfer.occurredAt)}'),
                      trailing: Text(TransferLabels.status(transfer.status)),
                      onTap: () => AppRoute.goToTransferDetail(
                        context: context,
                        transferId: transfer.id,
                        initial: transfer,
                      ),
                    ))
                .toList(growable: false),
      );
}

class _SectionCard extends StatelessWidget {
  const _SectionCard(
      {required this.title, required this.icon, required this.children});
  final String title;
  final IconData icon;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(children: <Widget>[
                Icon(icon, color: AppColors.primaryColor),
                const SizedBox(width: AppSpacing.sm),
                Text(title, style: Theme.of(context).textTheme.titleMedium),
              ]),
              const Divider(),
              ...children,
            ],
          ),
        ),
      );
}

class _Metrics extends StatelessWidget {
  const _Metrics({required this.values});
  final Map<String, String> values;
  @override
  Widget build(BuildContext context) => Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: values.entries
            .map((entry) => Container(
                  constraints: const BoxConstraints(minWidth: 94),
                  padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAltColor,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: Column(children: <Widget>[
                    Text(entry.value,
                        style: Theme.of(context).textTheme.titleMedium),
                    Text(entry.key,
                        style: Theme.of(context).textTheme.bodySmall),
                  ]),
                ))
            .toList(growable: false),
      );
}
