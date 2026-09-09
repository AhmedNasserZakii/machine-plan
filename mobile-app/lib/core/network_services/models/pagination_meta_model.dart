import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';

class PaginationMetaModel extends Equatable {
  const PaginationMetaModel({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNext,
    this.nextCursor,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasNext;

  /// Present on keyset endpoints only.
  final String? nextCursor;

  static const PaginationMetaModel empty = PaginationMetaModel(
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
  );

  factory PaginationMetaModel.fromJson(Map<String, dynamic> json) {
    final int page = json[ApiKeys.page] as int? ?? 1;
    final int totalPages = json[ApiKeys.totalPages] as int? ?? 0;

    return PaginationMetaModel(
      page: page,
      limit: json[ApiKeys.limit] as int? ?? 20,
      total: json[ApiKeys.total] as int? ?? 0,
      totalPages: totalPages,
      hasNext: json[ApiKeys.hasNext] as bool? ?? page < totalPages,
      nextCursor: json[ApiKeys.nextCursor] as String?,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    page,
    limit,
    total,
    totalPages,
    hasNext,
    nextCursor,
  ];
}
