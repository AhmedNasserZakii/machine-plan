// `easy_localization` re-exports intl's `TextDirection`, which would shadow
// the Flutter one used for the LTR phone field.
import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';

class PhoneField extends StatelessWidget {
  const PhoneField({
    required this.controller,
    super.key,
    this.onChanged,
    this.onFieldSubmitted,
    this.errorText,
    this.identifier,
  });

  final TextEditingController controller;
  final void Function(String)? onChanged;
  final void Function(String)? onFieldSubmitted;
  final String? errorText;
  final String? identifier;

  @override
  Widget build(BuildContext context) {
    return LabeledTextFormField(
      label: LocaleKeys.phoneNumber.tr(),
      hintText: '01XXXXXXXXX',
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.next,
      controller: controller,
      validation: AppValidators.isValidEgyptianPhone,
      onChanged: onChanged,
      onFieldSubmitted: onFieldSubmitted,
      errorText: errorText,
      identifier: identifier,
      maxLength: 14,
      inputFormatters: <TextInputFormatter>[
        FilteringTextInputFormatter.allow(RegExp(r'[0-9+]')),
      ],
      // A phone number stays LTR even inside the Arabic layout.
      textDirection: TextDirection.ltr,
      prefixIcon: const Icon(Icons.phone_outlined, size: 20),
    );
  }
}
