import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/nav_bar/presentation/models/nav_tab.dart';

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
        child: NavigationBar(
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
                    child: Icon(tab.icon, color: AppColors.textSecondaryColor),
                  ),
                  selectedIcon: Semantics(
                    identifier: tab.identifier,
                    child: Icon(tab.activeIcon, color: AppColors.primaryColor),
                  ),
                  label: tab.labelKey.tr(),
                ),
              )
              .toList(growable: false),
        ),
      ),
    );
  }

  static TextStyle labelStyle(BuildContext context) => Styles.s12(context);
}
