import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';

/// Turns the API's enums into the words a user reads. A raw status like
/// `WITH_MERCHANT` must never reach the screen.
abstract class MachineLabels {
  static String status(MachineStatus status) {
    return switch (status) {
      MachineStatus.inCompanyWarehouse =>
        LocaleKeys.machineStatusInCompanyWarehouse,
      MachineStatus.inBranchWarehouse =>
        LocaleKeys.machineStatusInBranchWarehouse,
      MachineStatus.withSupervisor => LocaleKeys.machineStatusWithSupervisor,
      MachineStatus.withRepresentative =>
        LocaleKeys.machineStatusWithRepresentative,
      MachineStatus.withMerchant => LocaleKeys.machineStatusWithMerchant,
      MachineStatus.inTransit => LocaleKeys.machineStatusInTransit,
      MachineStatus.underMaintenance =>
        LocaleKeys.machineStatusUnderMaintenance,
      MachineStatus.atFactory => LocaleKeys.machineStatusAtFactory,
      MachineStatus.atServiceCenter => LocaleKeys.machineStatusAtServiceCenter,
      MachineStatus.decommissioned => LocaleKeys.machineStatusDecommissioned,
      MachineStatus.replaced => LocaleKeys.machineStatusReplaced,
      MachineStatus.unknown => LocaleKeys.machineStatusUnknown,
    }.tr();
  }

  static String party(PartyType type) {
    return switch (type) {
      PartyType.factory => LocaleKeys.partyTypeFactory,
      PartyType.warehouse => LocaleKeys.partyTypeWarehouse,
      PartyType.supervisor => LocaleKeys.partyTypeSupervisor,
      PartyType.representative => LocaleKeys.partyTypeRepresentative,
      PartyType.merchant => LocaleKeys.partyTypeMerchant,
      PartyType.serviceCenter => LocaleKeys.partyTypeServiceCenter,
      PartyType.unknown => LocaleKeys.partyTypeUnknown,
    }.tr();
  }

  /// Which sticker a scan read. Worth saying out loud: the battery label sits
  /// next to the machine label, and reading the wrong one is a legitimate flow
  /// as long as the user knows it happened.
  static String matchedOn(ScannedSerialKind kind) {
    return switch (kind) {
      ScannedSerialKind.machine => LocaleKeys.matchedOnMachine,
      ScannedSerialKind.battery => LocaleKeys.matchedOnBattery,
      ScannedSerialKind.sim => LocaleKeys.matchedOnSim,
      ScannedSerialKind.box => LocaleKeys.matchedOnBox,
      ScannedSerialKind.unknown => LocaleKeys.matchedOnMachine,
    }.tr();
  }

  /// The statuses the filter sheet offers, in the order a unit moves through
  /// them. `unknown` is not a state anything can be filtered to.
  static const List<MachineStatus> filterableStatuses = <MachineStatus>[
    MachineStatus.inCompanyWarehouse,
    MachineStatus.inBranchWarehouse,
    MachineStatus.withSupervisor,
    MachineStatus.withRepresentative,
    MachineStatus.withMerchant,
    MachineStatus.inTransit,
    MachineStatus.underMaintenance,
    MachineStatus.atFactory,
    MachineStatus.atServiceCenter,
  ];

  static const List<PartyType> filterableHolders = <PartyType>[
    PartyType.warehouse,
    PartyType.supervisor,
    PartyType.representative,
    PartyType.merchant,
    PartyType.serviceCenter,
    PartyType.factory,
  ];
}
