import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/network_services/paginated_fetch.dart';

void main() {
  group('PaginatedFetch.collect', () {
    test('concatenates pages until hasNext is false', () async {
      final List<Map<String, dynamic>> rows = await PaginatedFetch.collect(
        path: 'suppliers',
        getPage: (int page, int limit) async {
          expect(limit, PaginatedFetch.maxLimit);
          if (page == 1) {
            return <String, dynamic>{
              'data': <Map<String, dynamic>>[
                <String, dynamic>{'id': 'a'},
              ],
              'meta': <String, dynamic>{
                'page': 1,
                'limit': 100,
                'total': 2,
                'totalPages': 2,
                'hasNext': true,
              },
            };
          }
          return <String, dynamic>{
            'data': <Map<String, dynamic>>[
              <String, dynamic>{'id': 'b'},
            ],
            'meta': <String, dynamic>{
              'page': 2,
              'limit': 100,
              'total': 2,
              'totalPages': 2,
              'hasNext': false,
            },
          };
        },
      );

      expect(rows.map((Map<String, dynamic> row) => row['id']), <String>['a', 'b']);
    });

    test('fails loudly when the page cap is hit', () async {
      expect(
        () => PaginatedFetch.collect(
          path: 'branches',
          maxPages: 2,
          getPage: (int page, int limit) async {
            return <String, dynamic>{
              'data': <Map<String, dynamic>>[
                <String, dynamic>{'id': '$page'},
              ],
              'meta': <String, dynamic>{
                'page': page,
                'limit': limit,
                'total': 1000,
                'totalPages': 20,
                'hasNext': true,
              },
            };
          },
        ),
        throwsA(isA<PaginatedFetchCapException>()),
      );
    });
  });
}
