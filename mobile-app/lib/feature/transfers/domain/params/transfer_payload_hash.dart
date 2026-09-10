import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';

/// The same canonical snapshot the server hashes a signature against
/// (`transfer-payload.ts`, `hashTransferPayload`), computed on the device so
/// the signing screen can show the sender exactly what fingerprint his
/// signature covers — before the transfer even exists server-side to compare
/// against.
///
/// Only the fields a person can verify by looking at the machines are
/// included, in the same order and shape the backend uses, sorted by
/// `machineId` so row order never changes the hash. `notes` is excluded for
/// the same reason the backend excludes it: it is commentary, not evidence.
class TransferPayloadHash {
  const TransferPayloadHash._();

  static String compute(List<DraftItem> items) {
    final List<Map<String, dynamic>> shaped =
        items
            .map(
              (DraftItem item) => <String, dynamic>{
                'machineId': item.machine.id,
                'batterySerialScanned': _blankToNull(
                  item.params.batterySerialScanned,
                ),
                'simSerialScanned': _blankToNull(item.params.simSerialScanned),
                'boxSerialScanned': _blankToNull(item.params.boxSerialScanned),
                'hasCharger': item.params.hasCharger,
                'hasBox': item.params.hasBox,
                'condition': item.params.condition.value,
              },
            )
            .toList()
          ..sort(
            (Map<String, dynamic> a, Map<String, dynamic> b) =>
                (a['machineId'] as String).compareTo(b['machineId'] as String),
          );

    return sha256.convert(utf8.encode(_stableStringify(shaped))).toString();
  }

  static String? _blankToNull(String? value) {
    final String? trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  /// Mirrors the backend's `stableStringify` (`hash.util.ts`) byte for byte:
  /// object keys sorted, no undefined (every key here is always present, so
  /// only the null case applies), arrays and primitives via plain JSON.
  static String _stableStringify(dynamic value) {
    if (value == null) return 'null';
    if (value is List) {
      return '[${value.map(_stableStringify).join(',')}]';
    }
    if (value is Map) {
      final List<MapEntry<dynamic, dynamic>> entries = value.entries.toList()
        ..sort(
          (MapEntry<dynamic, dynamic> a, MapEntry<dynamic, dynamic> b) =>
              (a.key as String).compareTo(b.key as String),
        );
      return '{${entries.map((MapEntry<dynamic, dynamic> e) => '${jsonEncode(e.key)}:${_stableStringify(e.value)}').join(',')}}';
    }
    return jsonEncode(value);
  }
}
