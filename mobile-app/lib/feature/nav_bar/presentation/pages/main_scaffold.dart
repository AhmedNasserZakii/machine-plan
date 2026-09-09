import 'package:flutter/material.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/offline_banner.dart';
import 'package:machinery/core/shared_widgets/sync_summary_bar.dart';
import 'package:machinery/feature/nav_bar/presentation/helpers/nav_tabs_builder.dart';
import 'package:machinery/feature/nav_bar/presentation/models/nav_tab.dart';
import 'package:machinery/feature/nav_bar/presentation/widgets/app_bottom_nav_bar.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key});

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  final PermissionService _permissionService = getIt<PermissionService>();
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<String>>(
      valueListenable: _permissionService.permissions,
      builder: (context, _, _) {
        final List<NavTab> tabs = NavTabsBuilder.build(_permissionService);

        // A permission revoked while the app is open can shrink the bar out
        // from under the selected index.
        final int safeIndex = _currentIndex.clamp(0, tabs.length - 1);

        return Scaffold(
          body: Column(
            children: <Widget>[
              const OfflineBanner(),
              const SyncSummaryBar(),
              Expanded(
                child: IndexedStack(
                  index: safeIndex,
                  children: tabs
                      .map((tab) => tab.pageBuilder())
                      .toList(growable: false),
                ),
              ),
            ],
          ),
          bottomNavigationBar: AppBottomNavBar(
            tabs: tabs,
            currentIndex: safeIndex,
            onTabSelected: (index) => setState(() => _currentIndex = index),
          ),
        );
      },
    );
  }
}
