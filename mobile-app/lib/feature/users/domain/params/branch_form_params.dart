import 'package:machinery/core/constants/api_keys.dart';

/// `POST /branches`. The server creates the branch warehouse alongside it, so
/// there is nothing else to send. [code] is immutable after create.
class CreateBranchParams {
  const CreateBranchParams({
    required this.code,
    required this.name,
    this.address,
    this.phone,
  });

  final String code;
  final String name;
  final String? address;
  final String? phone;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.code: code.trim().toUpperCase(),
      ApiKeys.name: name.trim(),
      if (_isSet(address)) ApiKeys.address: address!.trim(),
      if (_isSet(phone)) ApiKeys.phone: phone!.trim(),
    };
  }
}

/// `PATCH /branches/:id`. Code is never sent — it is set once at create.
class UpdateBranchParams {
  const UpdateBranchParams({required this.name, this.address, this.phone});

  final String name;
  final String? address;
  final String? phone;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.name: name.trim(),
      // Explicit null clears an optional field the admin wiped; an empty
      // string would fail the server's length check on phone.
      ApiKeys.address: _isSet(address) ? address!.trim() : null,
      ApiKeys.phone: _isSet(phone) ? phone!.trim() : null,
    };
  }
}

bool _isSet(String? value) => value != null && value.trim().isNotEmpty;
