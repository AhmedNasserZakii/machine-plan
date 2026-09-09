import 'package:equatable/equatable.dart';
import 'package:machinery/feature/auth/domain/entities/auth_user_entity.dart';

/// What `/auth/me` returns and what gets cached for offline start-up.
class AuthProfileEntity extends Equatable {
  const AuthProfileEntity({required this.user, required this.permissions});

  final AuthUserEntity user;
  final List<String> permissions;

  @override
  List<Object?> get props => <Object?>[user, permissions];
}
