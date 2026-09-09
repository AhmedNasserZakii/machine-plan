import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_cubit.dart';
import 'package:machinery/feature/finance/data/logic/finance_overview/finance_overview_cubit.dart';
import 'package:machinery/feature/finance/presentation/pages/finance_overview_screen.dart';
import 'package:machinery/feature/machines/presentation/pages/machines_list_screen.dart';
import 'package:machinery/feature/home/data/logic/home_dashboard_cubit.dart';
import 'package:machinery/feature/home/presentation/pages/home_dashboard_screen.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_cubit.dart';
import 'package:machinery/feature/merchants/presentation/pages/merchants_list_screen.dart';
import 'package:machinery/feature/more/presentation/pages/more_screen.dart';
import 'package:machinery/feature/nav_bar/presentation/models/nav_tab.dart';
import 'package:machinery/feature/transfers/data/logic/transfers_list/transfers_list_cubit.dart';
import 'package:machinery/feature/transfers/presentation/pages/transfers_list_screen.dart';

/// Builds the bottom bar from the permission list, never from a role name.
/// A representative ends up with four tabs and the Director with six, from the
/// same code path.
abstract class NavTabsBuilder {
  /// Anything beyond this breaks the bar on small screens, so the overflow
  /// lives under "More".
  static const int maxVisibleTabs = 5;

  static const NavTab _home = NavTab(
    labelKey: LocaleKeys.navHome,
    icon: Icons.home_outlined,
    activeIcon: Icons.home_rounded,
    pageBuilder: _buildHome,
  );

  static const NavTab _more = NavTab(
    labelKey: LocaleKeys.navMore,
    icon: Icons.more_horiz_outlined,
    activeIcon: Icons.more_horiz_rounded,
    pageBuilder: _buildMore,
  );

  static const List<NavTab> _gatedTabs = <NavTab>[
    NavTab(
      labelKey: LocaleKeys.navMachines,
      icon: Icons.precision_manufacturing_outlined,
      activeIcon: Icons.precision_manufacturing_rounded,
      permission: P.machinesRead,
      pageBuilder: _buildMachines,
    ),
    NavTab(
      labelKey: LocaleKeys.navTransfers,
      icon: Icons.swap_horiz_outlined,
      activeIcon: Icons.swap_horiz_rounded,
      permission: P.transfersRead,
      pageBuilder: _buildTransfers,
    ),
    NavTab(
      labelKey: LocaleKeys.navMerchants,
      icon: Icons.storefront_outlined,
      activeIcon: Icons.storefront_rounded,
      permission: P.merchantsRead,
      pageBuilder: _buildMerchants,
    ),
    NavTab(
      labelKey: LocaleKeys.navFinance,
      icon: Icons.account_balance_wallet_outlined,
      activeIcon: Icons.account_balance_wallet_rounded,
      permission: P.financeRead,
      pageBuilder: _buildFinance,
    ),
  ];

  static List<NavTab> build(PermissionService permissionService) {
    final List<NavTab> allowed = _gatedTabs
        .where((tab) => permissionService.has(tab.permission!))
        .toList(growable: false);

    // Home and More always occupy a slot, so the gated tabs share what is left.
    final int gatedSlots = maxVisibleTabs - 2;

    return <NavTab>[_home, ...allowed.take(gatedSlots), _more];
  }
}

Widget _buildHome() => BlocProvider<HomeDashboardCubit>(
  create: (_) => getIt<HomeDashboardCubit>(),
  child: const HomeDashboardScreen(),
);

Widget _buildMachines() => BlocProvider<MachinesListCubit>(
  create: (_) => getIt<MachinesListCubit>(),
  child: const MachinesListScreen(),
);

Widget _buildTransfers() => BlocProvider<TransfersListCubit>(
  create: (_) => getIt<TransfersListCubit>(),
  child: const TransfersListScreen(),
);

Widget _buildMerchants() => BlocProvider<MerchantsListCubit>(
  create: (_) => getIt<MerchantsListCubit>(),
  child: const MerchantsListScreen(),
);

Widget _buildFinance() => BlocProvider<FinanceOverviewCubit>(
  create: (_) => getIt<FinanceOverviewCubit>(),
  child: const FinanceOverviewScreen(),
);

Widget _buildMore() => const MoreScreen();
