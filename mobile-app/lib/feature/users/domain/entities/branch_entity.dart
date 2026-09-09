import 'package:equatable/equatable.dart';

/// A branch, as far as the user forms need it. The warehouse the API returns
/// alongside is not modelled here — nothing in this feature places machines.
class BranchEntity extends Equatable {
  const BranchEntity({
    required this.id,
    required this.code,
    required this.name,
    this.isActive = true,
  });

  final String id;
  final String code;
  final String name;
  final bool isActive;

  @override
  List<Object?> get props => <Object?>[id, code, name, isActive];
}
