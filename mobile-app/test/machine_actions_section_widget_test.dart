import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_actions_section.dart';
import 'package:shared_preferences/shared_preferences.dart';

const MachineEntity _activeMachine = MachineEntity(
  id: 'm1',
  serial: 'SN-1',
  status: MachineStatus.withRepresentative,
  hasBox: true,
  type: MachineTypeRef(id: 't1', name: 'Type', requiresSim: false),
  model: MachineModelRef(id: 'mo1', name: 'Model'),
  warranty: MachineWarranty(),
);

const MachineEntity _warehouseMachine = MachineEntity(
  id: 'm3',
  serial: 'SN-3',
  status: MachineStatus.inCompanyWarehouse,
  hasBox: true,
  type: MachineTypeRef(id: 't1', name: 'Type', requiresSim: false),
  model: MachineModelRef(id: 'mo1', name: 'Model'),
  warranty: MachineWarranty(),
);

const MachineEntity _decommissionedMachine = MachineEntity(
  id: 'm2',
  serial: 'SN-2',
  status: MachineStatus.decommissioned,
  hasBox: true,
  type: MachineTypeRef(id: 't1', name: 'Type', requiresSim: false),
  model: MachineModelRef(id: 'mo1', name: 'Model'),
  warranty: MachineWarranty(),
);

/// `PermissionGate` reads `getIt<PermissionService>()` directly, so this is
/// the smallest DI surface a test of `MachineActionsSection`'s gating needs —
/// no cubit, no repo, just the one service the widget actually depends on.
Future<PermissionService> _withPermissions(List<String> granted) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  LocalStorage.local = await SharedPreferences.getInstance();
  final PermissionService service = PermissionService();
  await service.update(granted);

  if (getIt.isRegistered<PermissionService>()) {
    getIt.unregister<PermissionService>();
  }
  getIt.registerSingleton<PermissionService>(service);
  return service;
}

Widget _wrap(Widget child) {
  return MaterialApp(home: Scaffold(body: child));
}

void main() {
  tearDown(() {
    if (getIt.isRegistered<PermissionService>()) {
      getIt.unregister<PermissionService>();
    }
  });

  testWidgets(
    'every permission granted on an active machine shows every action',
    (tester) async {
      await _withPermissions(<String>[
        P.maintenanceRead,
        P.maintenanceCreate,
        P.transfersCreate,
        P.machinesCreate,
        P.maintenanceClose,
        P.machinesDecommission,
      ]);

      await tester.pumpWidget(
        _wrap(
          MachineActionsSection(
            machine: _warehouseMachine,
            onViewTimeline: () {},
            onViewMaintenanceHistory: () {},
            onCreateTransfer: () {},
            onSendForMaintenance: () {},
            onReplace: () {},
            onDecommission: () {},
          ),
        ),
      );

      expect(
        find.widgetWithIcon(ListTile, Icons.history_rounded),
        findsOneWidget,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.build_circle_outlined),
        findsOneWidget,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.swap_horiz_rounded),
        findsOneWidget,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.build_outlined),
        findsOneWidget,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.change_circle_outlined),
        findsOneWidget,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.delete_forever_rounded),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'no permissions beyond reading the machine shows only the timeline',
    (tester) async {
      await _withPermissions(<String>[P.machinesRead]);

      await tester.pumpWidget(
        _wrap(
          MachineActionsSection(
            machine: _activeMachine,
            onViewTimeline: () {},
            onViewMaintenanceHistory: () {},
            onCreateTransfer: () {},
            onSendForMaintenance: () {},
            onReplace: () {},
            onDecommission: () {},
          ),
        ),
      );

      expect(
        find.widgetWithIcon(ListTile, Icons.history_rounded),
        findsOneWidget,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.build_circle_outlined),
        findsNothing,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.swap_horiz_rounded),
        findsNothing,
      );
      expect(find.widgetWithIcon(ListTile, Icons.build_outlined), findsNothing);
      expect(
        find.widgetWithIcon(ListTile, Icons.change_circle_outlined),
        findsNothing,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.delete_forever_rounded),
        findsNothing,
      );
    },
  );

  testWidgets(
    'a retired machine hides transfer, replace and decommission even with every permission',
    (tester) async {
      await _withPermissions(<String>[
        P.maintenanceRead,
        P.maintenanceCreate,
        P.transfersCreate,
        P.maintenanceClose,
        P.machinesDecommission,
      ]);

      await tester.pumpWidget(
        _wrap(
          MachineActionsSection(
            machine: _decommissionedMachine,
            onViewTimeline: () {},
            onViewMaintenanceHistory: () {},
            onCreateTransfer: () {},
            onSendForMaintenance: () {},
            onReplace: () {},
            onDecommission: () {},
          ),
        ),
      );

      expect(
        find.widgetWithIcon(ListTile, Icons.history_rounded),
        findsOneWidget,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.build_circle_outlined),
        findsOneWidget,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.swap_horiz_rounded),
        findsNothing,
      );
      expect(find.widgetWithIcon(ListTile, Icons.build_outlined), findsNothing);
      expect(
        find.widgetWithIcon(ListTile, Icons.change_circle_outlined),
        findsNothing,
      );
      expect(
        find.widgetWithIcon(ListTile, Icons.delete_forever_rounded),
        findsNothing,
      );
    },
  );

  testWidgets('tapping the timeline action calls its callback', (tester) async {
    await _withPermissions(<String>[]);
    int taps = 0;

    await tester.pumpWidget(
      _wrap(
        MachineActionsSection(
          machine: _activeMachine,
          onViewTimeline: () => taps++,
          onViewMaintenanceHistory: () {},
          onCreateTransfer: () {},
          onSendForMaintenance: () {},
          onReplace: () {},
          onDecommission: () {},
        ),
      ),
    );

    await tester.tap(find.widgetWithIcon(ListTile, Icons.history_rounded));
    await tester.pump();

    expect(taps, 1);
  });

  testWidgets('tapping the send-for-maintenance action calls its callback', (
    tester,
  ) async {
    await _withPermissions(<String>[P.maintenanceCreate]);
    int taps = 0;

    await tester.pumpWidget(
      _wrap(
        MachineActionsSection(
          machine: _warehouseMachine,
          onViewTimeline: () {},
          onViewMaintenanceHistory: () {},
          onCreateTransfer: () {},
          onSendForMaintenance: () => taps++,
          onReplace: () {},
          onDecommission: () {},
        ),
      ),
    );

    await tester.tap(find.widgetWithIcon(ListTile, Icons.build_outlined));
    await tester.pump();

    expect(taps, 1);
  });

  testWidgets(
    'a machine outside the warehouse or factory hides maintenance and replacement',
    (tester) async {
      await _withPermissions(<String>[
        P.maintenanceCreate,
        P.machinesCreate,
        P.maintenanceClose,
      ]);

      await tester.pumpWidget(
        _wrap(
          MachineActionsSection(
            machine: _activeMachine,
            onViewTimeline: () {},
            onViewMaintenanceHistory: () {},
            onCreateTransfer: () {},
            onSendForMaintenance: () {},
            onReplace: () {},
            onDecommission: () {},
          ),
        ),
      );

      expect(find.widgetWithIcon(ListTile, Icons.build_outlined), findsNothing);
      expect(
        find.widgetWithIcon(ListTile, Icons.change_circle_outlined),
        findsNothing,
      );
    },
  );
}
