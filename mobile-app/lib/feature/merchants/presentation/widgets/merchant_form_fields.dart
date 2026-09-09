import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_state.dart';
import 'package:machinery/feature/merchants/presentation/widgets/merchant_duplicate_notice.dart';

/// The registration fields, in the order a representative collects them
/// standing in the shop: the place first, then the person, then the paperwork.
class MerchantFormFields extends StatelessWidget {
  const MerchantFormFields({
    required this.state,
    required this.shopNameController,
    required this.nameController,
    required this.phoneController,
    required this.addressController,
    required this.nationalIdController,
    required this.notesController,
    required this.onIdentityChanged,
    super.key,
  });

  final MerchantFormReady state;
  final TextEditingController shopNameController;
  final TextEditingController nameController;
  final TextEditingController phoneController;
  final TextEditingController addressController;
  final TextEditingController nationalIdController;
  final TextEditingController notesController;

  /// Fires on every phone or national ID keystroke, so the duplicate check can
  /// debounce them together rather than racing two timers.
  final VoidCallback onIdentityChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        LabeledTextFormField(
          label: LocaleKeys.merchantShopName.tr(),
          hintText: LocaleKeys.merchantShopName.tr(),
          controller: shopNameController,
          identifier: 'merchant_form_shop_name',
          validation: AppValidators.isNotEmptyValidator,
          errorText: state.fieldErrors['shopName'],
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.merchantName.tr(),
          hintText: LocaleKeys.merchantName.tr(),
          controller: nameController,
          identifier: 'merchant_form_name',
          validation: AppValidators.isNotEmptyValidator,
          errorText: state.fieldErrors['name'],
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.merchantPhone.tr(),
          hintText: '01xxxxxxxxx',
          controller: phoneController,
          keyboardType: TextInputType.phone,
          textDirection: TextDirection.ltr,
          identifier: 'merchant_form_phone',
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
          ],
          maxLength: 11,
          validation: AppValidators.isValidEgyptianPhone,
          errorText: state.fieldErrors['phone'],
          onChanged: (_) => onIdentityChanged(),
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.merchantAddress.tr(),
          hintText: LocaleKeys.merchantAddress.tr(),
          controller: addressController,
          maxLines: 2,
          identifier: 'merchant_form_address',
          validation: AppValidators.isNotEmptyValidator,
          errorText: state.fieldErrors['address'],
        ),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.merchantNationalId.tr(),
          hintText: LocaleKeys.merchantNationalIdHint.tr(),
          controller: nationalIdController,
          keyboardType: TextInputType.number,
          textDirection: TextDirection.ltr,
          identifier: 'merchant_form_national_id',
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
          ],
          maxLength: 14,
          validation: AppValidators.isValidNationalId,
          errorText: state.fieldErrors['nationalId'],
          onChanged: (_) => onIdentityChanged(),
        ),

        // The notice sits directly under the two fields it is about. Further
        // down the form it would be below the fold, and a save button that
        // greys out with the reason scrolled off screen reads as a bug.
        MerchantDuplicateNotice(state: state),
        const SizedBox(height: AppSpacing.md),

        LabeledTextFormField(
          label: LocaleKeys.merchantNotes.tr(),
          hintText: LocaleKeys.merchantNotes.tr(),
          controller: notesController,
          maxLines: 3,
          textInputAction: TextInputAction.done,
          identifier: 'merchant_form_notes',
          errorText: state.fieldErrors['notes'],
        ),
      ],
    );
  }
}
