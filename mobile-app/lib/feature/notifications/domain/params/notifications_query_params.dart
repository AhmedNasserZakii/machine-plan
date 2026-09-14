import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Filter set behind `GET /notifications`.
class NotificationsQueryParams extends Equatable {
  const NotificationsQueryParams({
    this.page = 1,
    this.limit = 20,
    this.unreadOnly = false,
    this.templateCode,
  });

  final int page;
  final int limit;
  final bool unreadOnly;
  final NotificationTemplateCode? templateCode;

  NotificationsQueryParams copyWith({
    int? page,
    int? limit,
    bool? unreadOnly,
    NotificationTemplateCode? templateCode,
    bool resetTemplate = false,
  }) {
    return NotificationsQueryParams(
      page: page ?? this.page,
      limit: limit ?? this.limit,
      unreadOnly: unreadOnly ?? this.unreadOnly,
      templateCode: resetTemplate ? null : (templateCode ?? this.templateCode),
    );
  }

  Map<String, dynamic> toQuery() {
    return <String, dynamic>{
      ApiKeys.page: page,
      ApiKeys.limit: limit,
      if (unreadOnly) ApiKeys.unreadOnly: true,
      if (templateCode != null &&
          templateCode != NotificationTemplateCode.unknown)
        ApiKeys.templateCode: templateCode!.value,
    };
  }

  @override
  List<Object?> get props => <Object?>[page, limit, unreadOnly, templateCode];
}
