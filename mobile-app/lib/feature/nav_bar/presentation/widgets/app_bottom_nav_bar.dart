import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/nav_bar/presentation/models/nav_tab.dart';
import 'package:machinery/feature/notifications/data/logic/notification_badge/notification_badge_cubit.dart';
import 'package:machinery/feature/notifications/data/logic/notification_badge/notification_badge_state.dart';

class AppBottomNavBar extends StatelessWidget {
  const AppBottomNavBar({
    required this.tabs,
    required this.currentIndex,
    required this.onTabSelected,
    super.key,
  });

  final List<NavTab> tabs;
  final int currentIndex;
  final ValueChanged<int> onTabSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surfaceColor,
        border: Border(top: BorderSide(color: AppColors.dividerColor)),
      ),
      child: SafeArea(
        top: false,
        child: BlocBuilder<NotificationBadgeCubit, NotificationBadgeState>(
          builder: (BuildContext context, NotificationBadgeState badge) {
            return NavigationBar(
              selectedIndex: currentIndex,
              onDestinationSelected: onTabSelected,
              backgroundColor: AppColors.surfaceColor,
              surfaceTintColor: Colors.transparent,
              indicatorColor: AppColors.infoSurfaceColor,
              height: 68,
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              destinations: tabs
                  .map(
                    (tab) => NavigationDestination(
                      icon: Semantics(
                        identifier: tab.identifier,
                        child: _navIcon(
                          tab.icon,
                          color: AppColors.textSecondaryColor,
                          badgeCount: tab.identifier == 'nav_tab_more'
                              ? badge.unread
                              : 0,
                        ),
                      ),
                      selectedIcon: Semantics(
                        identifier: tab.identifier,
                        child: _navIcon(
                          tab.activeIcon,
                          color: AppColors.primaryColor,
                          badgeCount: tab.identifier == 'nav_tab_more'
                              ? badge.unread
                              : 0,
                        ),
                      ),
                      label: tab.labelKey.tr(),
                    ),
                  )
                  .toList(growable: false),
            );
          },
        ),
      ),
    );
  }

  static Widget _navIcon(
    IconData icon, {
    required Color color,
    required int badgeCount,
  }) {
    final Widget child = Icon(icon, color: color);
    if (badgeCount <= 0) {
      return child;
    }
    return Badge(
      backgroundColor: AppColors.badgeColor,
      label: Text(badgeCount > 99 ? '99+' : '$badgeCount'),
      child: child,
    );
  }

  static TextStyle labelStyle(BuildContext context) => Styles.s12(context);
}
