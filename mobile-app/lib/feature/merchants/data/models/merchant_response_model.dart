import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';

/// `GET /merchants`, `GET /merchants/:id` and the two write endpoints.
///
/// The list row and the detail body are the same shape with the detail carrying
/// six extra fields, so one parser covers both: what it does not find falls
/// back rather than making the caller pick a model.
class MerchantResponseModel {
  const MerchantResponseModel({required this.entity});

  final MerchantEntity entity;

  factory MerchantResponseModel.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> branch = JsonReader.object(json[ApiKeys.branch]);
    final Map<String, dynamic> registeredBy = JsonReader.object(
      json[ApiKeys.registeredBy],
    );
    final Map<String, dynamic> subscription = JsonReader.object(
      json[ApiKeys.activeSubscription],
    );

    return MerchantResponseModel(
      entity: MerchantEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        name: json[ApiKeys.name] as String? ?? '',
        shopName: json[ApiKeys.shopName] as String? ?? '',
        phone: json[ApiKeys.phone] as String? ?? '',
        address: json[ApiKeys.address] as String?,
        nationalId: json[ApiKeys.nationalId] as String?,
        branch: branch.isEmpty
            ? null
            : BranchRef(
                id: branch[ApiKeys.id]?.toString() ?? '',
                name: branch[ApiKeys.name] as String? ?? '',
              ),
        registeredBy: registeredBy.isEmpty
            ? null
            : MerchantUserRef(
                id: registeredBy[ApiKeys.id]?.toString() ?? '',
                fullName: registeredBy[ApiKeys.fullName] as String? ?? '',
              ),
        machinesCount: JsonReader.integer(json[ApiKeys.machinesCount]),
        activeSubscription: subscription.isEmpty
            ? null
            : SubscriptionResponseModel.fromJson(subscription).toEntity(),
        totalPaid: JsonReader.decimal(json[ApiKeys.totalPaid]) ?? 0,
        notes: json[ApiKeys.notes] as String?,
        createdAt: JsonReader.dateOrNull(json[ApiKeys.createdAt]),
        // A row that arrives without the flag is one the live list asked for,
        // so treating it as active keeps its actions available.
        isActive: json[ApiKeys.isActive] as bool? ?? true,
      ),
    );
  }

  MerchantEntity toEntity() => entity;
}

class SubscriptionResponseModel {
  const SubscriptionResponseModel({required this.entity});

  final SubscriptionEntity entity;

  factory SubscriptionResponseModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionResponseModel(
      entity: SubscriptionEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        planType: SubscriptionPlanType.fromJson(
          json[ApiKeys.planType] as String?,
        ),
        machineId: json[ApiKeys.machineId]?.toString(),
        machineSerial: json[ApiKeys.machineSerial] as String?,
        amount: JsonReader.decimal(json[ApiKeys.amount]) ?? 0,
        startDate: json[ApiKeys.startDate] as String? ?? '',
        endDate: json[ApiKeys.endDate] as String?,
        nextDueDate: json[ApiKeys.nextDueDate] as String?,
        isOverdue: json[ApiKeys.isOverdue] as bool? ?? false,
        totalCollected: JsonReader.decimal(json[ApiKeys.totalCollected]) ?? 0,
        collectionCount: JsonReader.integer(json[ApiKeys.collectionCount]),
        lastCollectedAt: JsonReader.dateOrNull(json[ApiKeys.lastCollectedAt]),
        isActive: json[ApiKeys.isActive] as bool? ?? true,
        notes: json[ApiKeys.notes] as String?,
      ),
    );
  }

  SubscriptionEntity toEntity() => entity;
}

class MerchantDuplicateCheckModel {
  const MerchantDuplicateCheckModel({required this.result});

  final MerchantDuplicateCheck result;

  factory MerchantDuplicateCheckModel.fromJson(Map<String, dynamic> json) {
    final dynamic warnings = json[ApiKeys.warnings];
    final dynamic existing = json[ApiKeys.existing];

    return MerchantDuplicateCheckModel(
      result: MerchantDuplicateCheck(
        warnings: warnings is List
            ? warnings
                  .map(
                    (dynamic raw) =>
                        MerchantDuplicateWarning.fromJson(raw as String?),
                  )
                  .toList(growable: false)
            : const <MerchantDuplicateWarning>[],
        existing: existing is List
            ? existing
                  .whereType<Map<String, dynamic>>()
                  .map(
                    (Map<String, dynamic> row) =>
                        MerchantResponseModel.fromJson(row).toEntity(),
                  )
                  .toList(growable: false)
            : const <MerchantEntity>[],
      ),
    );
  }

  MerchantDuplicateCheck toEntity() => result;
}

class MerchantTimelineEntryModel {
  const MerchantTimelineEntryModel({required this.entry});

  final MerchantTimelineEntry entry;

  factory MerchantTimelineEntryModel.fromJson(Map<String, dynamic> json) {
    return MerchantTimelineEntryModel(
      entry: MerchantTimelineEntry(
        kind: MerchantTimelineKind.fromJson(json[ApiKeys.kind] as String?),
        occurredAt:
            JsonReader.dateOrNull(json[ApiKeys.occurredAt]) ??
            DateTime.fromMillisecondsSinceEpoch(0),
        code: json[ApiKeys.code] as String? ?? '',
        referenceNo: json[ApiKeys.referenceNo] as String?,
        machineSerial: json[ApiKeys.machineSerial] as String?,
        amount: JsonReader.decimal(json[ApiKeys.amount]),
      ),
    );
  }

  MerchantTimelineEntry toEntity() => entry;
}

/// Shared JSON coercion. Every model in the feature needs the same three
/// conversions, and a second private copy is how one of them ends up throwing
/// on a string where the other returns zero.
abstract class JsonReader {
  static Map<String, dynamic> object(dynamic raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};

  /// `pg` sends `numeric` columns as strings so no precision is lost in
  /// transit, and JSON numbers arrive as `int` when they happen to be whole.
  static double? decimal(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  static int integer(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  /// A malformed timestamp must not take the whole list down with it.
  static DateTime? dateOrNull(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value)?.toLocal();
  }
}
