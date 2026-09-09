import 'package:equatable/equatable.dart';
import 'package:machinery/feature/auth/domain/entities/auth_profile_entity.dart';

/// What a successful login returns. Tokens never leave the secure storage the
/// repository writes them to, and are never logged or displayed.
class AuthSessionEntity extends Equatable {
  const AuthSessionEntity({
    required this.accessToken,
    required this.refreshToken,
    required this.profile,
  });

  final String accessToken;
  final String refreshToken;
  final AuthProfileEntity profile;

  @override
  List<Object?> get props => <Object?>[accessToken, refreshToken, profile];
}
