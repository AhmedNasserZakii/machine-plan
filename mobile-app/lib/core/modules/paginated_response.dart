import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';

/// Parses `{ success, data: { items: [...] }, meta: { ... } }` once so no
/// feature ever reaches into `response.data['data']` by hand.
class PaginatedResponse<T> extends Equatable {
  const PaginatedResponse({required this.items, required this.meta});

  final List<T> items;
  final PaginationMetaModel meta;

  bool get hasNext => meta.hasNext;

  factory PaginatedResponse.empty() {
    return PaginatedResponse<T>(
      items: const <Never>[],
      meta: PaginationMetaModel.empty,
    );
  }

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) itemFromJson,
  ) {
    final dynamic data = json[ApiKeys.data];

    // `data` is either the list itself or an object wrapping `items`.
    final List<dynamic> rawItems = switch (data) {
      final List<dynamic> list => list,
      final Map<String, dynamic> map =>
        map[ApiKeys.items] as List<dynamic>? ?? const <dynamic>[],
      _ => const <dynamic>[],
    };

    final dynamic meta = json[ApiKeys.meta];

    return PaginatedResponse<T>(
      items: rawItems
          .whereType<Map<String, dynamic>>()
          .map(itemFromJson)
          .toList(growable: false),
      meta: meta is Map<String, dynamic>
          ? PaginationMetaModel.fromJson(meta)
          : PaginationMetaModel.empty,
    );
  }

  @override
  List<Object?> get props => <Object?>[items, meta];
}
