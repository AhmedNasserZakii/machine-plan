import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/error_mapper.dart';

abstract class Failures {
  Failures(this.errorMessage);

  final String errorMessage;
}

/// The single API/network failure type. Subclasses exist only where the UI has
/// to behave differently — a 409 offers a refresh, a 422 explains and does not
/// offer a retry, a 400 maps onto form fields.
class ServerFailure extends Failures {
  ServerFailure(
    super.errorMessage, {
    this.code = '',
    this.statusCode,
    this.isUnauthorized = false,
    this.fieldErrors = const <String, String>{},
  });

  final String code;
  final int? statusCode;
  final bool isUnauthorized;
  final Map<String, String> fieldErrors;

  factory ServerFailure.fromDioException(DioException dioException) {
    switch (dioException.type) {
      case DioExceptionType.connectionTimeout:
        return ServerFailure(LocaleKeys.connectionTimeOutWithApiServer.tr());
      case DioExceptionType.sendTimeout:
        return ServerFailure(LocaleKeys.sendTimeOutWithApiServer.tr());
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return ServerFailure(LocaleKeys.receiveTimeOutWithApiServer.tr());
      case DioExceptionType.badCertificate:
        return ServerFailure(LocaleKeys.badCertificateWithApiServer.tr());
      case DioExceptionType.cancel:
        return ServerFailure(LocaleKeys.requestToApiServerWasCanceled.tr());
      case DioExceptionType.badResponse:
        final int? statusCode = dioException.response?.statusCode;
        final dynamic responseData = dioException.response?.data;
        if (statusCode != null) {
          return ServerFailure.fromResponse(statusCode, responseData);
        }
        return ServerFailure(_extractMessage(responseData, ''));
      case DioExceptionType.connectionError:
        return _isNoInternetError(dioException)
            ? OfflineFailure()
            : ServerFailure(LocaleKeys.connectionErrorWithApiServer.tr());
      case DioExceptionType.unknown:
        return _isNoInternetError(dioException)
            ? OfflineFailure()
            : ServerFailure(LocaleKeys.unknownErrorWithApiServer.tr());
    }
  }

  factory ServerFailure.fromResponse(int statusCode, dynamic response) {
    final String code = _extractCode(response);
    final String message = _extractMessage(response, code);

    return switch (statusCode) {
      401 || 403 => ServerFailure(
          message,
          code: code,
          statusCode: statusCode,
          isUnauthorized: statusCode == 401,
        ),
      400 => ValidationFailure(
          message,
          code: code,
          statusCode: statusCode,
          fieldErrors: _extractFieldErrors(response),
        ),
      409 => ConflictFailure(message, code: code, statusCode: statusCode),
      422 => BusinessFailure(message, code: code, statusCode: statusCode),
      426 => UpgradeRequiredFailure(
          message,
          code: code,
          statusCode: statusCode,
          minVersion: _extractMinVersion(response),
        ),
      _ => code == 'CLIENT_UPGRADE_REQUIRED'
          ? UpgradeRequiredFailure(
              message,
              code: code,
              statusCode: statusCode,
              minVersion: _extractMinVersion(response),
            )
          : ServerFailure(message, code: code, statusCode: statusCode),
    };
  }

  // ── Envelope parsing ─────────────────────────────────────────────────────

  static Map<String, dynamic>? _errorObject(dynamic response) {
    if (response is! Map<String, dynamic>) {
      return null;
    }
    final dynamic error = response[ApiKeys.error];
    return error is Map<String, dynamic> ? error : null;
  }

  static String _extractCode(dynamic response) {
    final dynamic code = _errorObject(response)?[ApiKeys.code];
    return code is String ? code : '';
  }

  static String? _extractMinVersion(dynamic response) {
    final Map<String, dynamic>? error = _errorObject(response);
    final dynamic extra = error?['extra'] ?? error?[ApiKeys.details];
    if (extra is Map<String, dynamic>) {
      final dynamic value = extra['minVersion'];
      if (value is String && value.isNotEmpty) return value;
    }
    final dynamic params = error?['params'];
    if (params is Map<String, dynamic>) {
      final dynamic value = params['minVersion'];
      if (value is String && value.isNotEmpty) return value;
    }
    return null;
  }

  static String _extractMessage(dynamic response, String code) {
    final Map<String, dynamic>? error = _errorObject(response);
    final dynamic errorMessage = error?[ApiKeys.message];

    if (errorMessage is String && errorMessage.trim().isNotEmpty) {
      return ErrorMapper.messageFor(code: code, serverMessage: errorMessage);
    }

    // Some endpoints (and proxies) answer with a bare `message`.
    if (response is Map<String, dynamic>) {
      final dynamic bare = response[ApiKeys.message];
      if (bare is String && bare.trim().isNotEmpty) {
        return ErrorMapper.messageFor(code: code, serverMessage: bare);
      }
      if (bare is List && bare.isNotEmpty && bare.first is String) {
        return ErrorMapper.messageFor(
          code: code,
          serverMessage: bare.first as String,
        );
      }
    }

    return ErrorMapper.messageFor(code: code, serverMessage: null);
  }

  /// Turns `error.details` into a `field -> message` map the form can render
  /// inline. Anything unparseable is dropped rather than guessed at.
  static Map<String, String> _extractFieldErrors(dynamic response) {
    final dynamic details = _errorObject(response)?[ApiKeys.details];
    final Map<String, String> fieldErrors = <String, String>{};

    if (details is List) {
      for (final dynamic detail in details) {
        if (detail is! Map<String, dynamic>) {
          continue;
        }
        final dynamic field = detail['field'];
        final dynamic message = detail[ApiKeys.message];
        if (field is String && message is String) {
          fieldErrors[field] = message;
        }
      }
    } else if (details is Map<String, dynamic>) {
      for (final MapEntry<String, dynamic> entry in details.entries) {
        final dynamic value = entry.value;
        if (value is String) {
          fieldErrors[entry.key] = value;
        } else if (value is List && value.isNotEmpty && value.first is String) {
          fieldErrors[entry.key] = value.first as String;
        }
      }
    }

    return fieldErrors;
  }

  static bool _isNoInternetError(DioException dioException) {
    final String message = (dioException.message ?? '').toLowerCase();
    final String errorText = dioException.error?.toString().toLowerCase() ?? '';
    const List<String> markers = <String>[
      'socketexception',
      'failed host lookup',
      'network is unreachable',
      'connection refused',
    ];

    return markers.any(
      (marker) => message.contains(marker) || errorText.contains(marker),
    );
  }
}

/// No connection. Read paths fall back to the cache; write paths queue.
class OfflineFailure extends ServerFailure {
  OfflineFailure([String? message])
      : super(message ?? LocaleKeys.noInternetConnection.tr());
}

/// 400 — the form has field-level problems to render inline.
class ValidationFailure extends ServerFailure {
  ValidationFailure(
    super.errorMessage, {
    super.code,
    super.statusCode,
    super.fieldErrors,
  });
}

/// 409 — someone else changed the record. Offer a refresh, never a blind retry.
class ConflictFailure extends ServerFailure {
  ConflictFailure(super.errorMessage, {super.code, super.statusCode});
}

/// 422 — a business rule rejected this. Explain it; do not offer a retry.
class BusinessFailure extends ServerFailure {
  BusinessFailure(super.errorMessage, {super.code, super.statusCode});
}

/// 426 — the installed app is below `MIN_CLIENT_VERSION`. Block the UI.
class UpgradeRequiredFailure extends ServerFailure {
  UpgradeRequiredFailure(
    super.errorMessage, {
    super.code,
    super.statusCode,
    this.minVersion,
  });

  final String? minVersion;
}

/// 400 on `POST /machines/bulk` — the whole batch was refused, and [problems]
/// names every row that failed (`field: constraint`, e.g.
/// `machines[2].serial: must be longer than or equal to 3 characters`), not
/// just the first. The import is all-or-nothing, so nothing was created.
class BulkImportValidationFailure extends ServerFailure {
  BulkImportValidationFailure(
    super.errorMessage, {
    required this.problems,
    super.code,
    super.statusCode,
  });

  final List<String> problems;
}
