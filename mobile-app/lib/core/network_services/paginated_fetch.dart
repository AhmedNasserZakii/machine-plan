import 'package:dio/dio.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/modules/paginated_response.dart';

/// Thrown when [PaginatedFetch.collect] walks [maxPages] and `meta.hasNext`
/// is still true. Callers must surface this as a failure rather than return a
/// silently truncated list — that is the whole point of the helper.
class PaginatedFetchCapException implements Exception {
  const PaginatedFetchCapException({required this.path, required this.pages});

  final String path;
  final int pages;

  @override
  String toString() =>
      'PaginatedFetchCapException(path: $path, pages: $pages)';
}

/// Walks an offset-paginated list until the server says there is no next page.
///
/// Used by the session lookup cache and the offline finance refs: both used to
/// assume the server returned every row in one shot, which silently truncated
/// them the moment those routes gained a default `limit` of 20.
class PaginatedFetch {
  static const int maxLimit = 100;
  static const int maxPages = 10;

  /// [getPage] returns the full `{ success, data, meta }` envelope for one
  /// page. Exposed as a callback so a test can drive the loop without Dio.
  static Future<List<Map<String, dynamic>>> collect({
    required String path,
    required Future<Map<String, dynamic>> Function(int page, int limit)
        getPage,
    int maxPages = PaginatedFetch.maxPages,
    int limit = PaginatedFetch.maxLimit,
  }) async {
    final List<Map<String, dynamic>> items = <Map<String, dynamic>>[];
    int page = 1;

    while (true) {
      if (page > maxPages) {
        throw PaginatedFetchCapException(path: path, pages: maxPages);
      }

      final PaginatedResponse<Map<String, dynamic>> parsed =
          PaginatedResponse<Map<String, dynamic>>.fromJson(
        await getPage(page, limit),
        (Map<String, dynamic> json) => json,
      );

      items.addAll(parsed.items);

      if (!parsed.hasNext) {
        return items;
      }

      page++;
    }
  }

  static Future<List<Map<String, dynamic>>> all({
    required Dio client,
    required String path,
    Map<String, dynamic>? extraQuery,
    int maxPages = PaginatedFetch.maxPages,
    int limit = PaginatedFetch.maxLimit,
  }) {
    return collect(
      path: path,
      maxPages: maxPages,
      limit: limit,
      getPage: (int page, int pageLimit) async {
        final Response<dynamic> response = await client.get<dynamic>(
          path,
          queryParameters: <String, dynamic>{
            ApiKeys.page: page,
            ApiKeys.limit: pageLimit,
            ...?extraQuery,
          },
        );

        return response.data is Map<String, dynamic>
            ? response.data as Map<String, dynamic>
            : const <String, dynamic>{};
      },
    );
  }
}
