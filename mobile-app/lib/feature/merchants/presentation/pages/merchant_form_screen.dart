import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_cubit.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_state.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/widgets/merchant_form_fields.dart';

/// Registers a merchant, or corrects one. [existing] decides which.
class MerchantFormScreen extends StatefulWidget {
  const MerchantFormScreen({super.key, this.existing});

  final MerchantEntity? existing;

  @override
  State<MerchantFormScreen> createState() => _MerchantFormScreenState();
}

class _MerchantFormScreenState extends State<MerchantFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _shopNameController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _nationalIdController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();

    final MerchantEntity? existing = widget.existing;
    if (existing != null) {
      _shopNameController.text = existing.shopName;
      _nameController.text = existing.name;
      _phoneController.text = existing.phone;
      _addressController.text = existing.address ?? '';
      _nationalIdController.text = existing.nationalId ?? '';
      _notesController.text = existing.notes ?? '';
    }
  }

  @override
  void dispose() {
    _shopNameController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _nationalIdController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  /// An edit keeps the record it is already on, so re-checking its own phone
  /// would warn about itself.
  void _checkDuplicates() {
    if (_isEditing) {
      return;
    }

    context.read<MerchantFormCubit>().checkDuplicates(
      phone: _phoneController.text,
      nationalId: _nullIfBlank(_nationalIdController.text),
    );
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    context.read<MerchantFormCubit>().submit(
      name: _nameController.text.trim(),
      phone: AppValidators.normalizeEgyptianPhone(_phoneController.text),
      shopName: _shopNameController.text.trim(),
      address: _addressController.text.trim(),
      nationalId: _nullIfBlank(_nationalIdController.text),
      notes: _nullIfBlank(_notesController.text),
    );
  }

  /// An empty box means "not recorded", not an empty string — sending `""` for
  /// an optional national ID would take a unique slot nothing else could use.
  String? _nullIfBlank(String raw) {
    final String trimmed = raw.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(
          _isEditing
              ? LocaleKeys.merchantEditTitle.tr()
              : LocaleKeys.merchantRegisterTitle.tr(),
        ),
      ),
      body: BlocConsumer<MerchantFormCubit, MerchantFormState>(
        listener: (BuildContext context, MerchantFormState state) {
          if (state is MerchantFormSubmitFailure) {
            showErrorToast(state.errorMessage, context);
          }

          if (state is MerchantFormSubmitted) {
            showSuccessToast(
              state.wasCreated
                  ? LocaleKeys.merchantCreated.tr()
                  : LocaleKeys.merchantUpdated.tr(),
              context,
            );
            AppRoute.goBack(context: context, result: state.merchant);
          }
        },
        builder: (BuildContext context, MerchantFormState state) {
          return state is MerchantFormReady
              ? _buildForm(context, state)
              : const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, MerchantFormReady state) {
    return SafeArea(
      child: Column(
        children: <Widget>[
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Form(
                key: _formKey,
                child: MerchantFormFields(
                  state: state,
                  shopNameController: _shopNameController,
                  nameController: _nameController,
                  phoneController: _phoneController,
                  addressController: _addressController,
                  nationalIdController: _nationalIdController,
                  notesController: _notesController,
                  onIdentityChanged: _checkDuplicates,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: PermissionGate(
              permission: _isEditing ? P.merchantsUpdate : P.merchantsCreate,
              child: CustomButton(
                title: LocaleKeys.save.tr(),
                isLoading: state.isSubmitting,
                identifier: 'merchant_form_submit',
                // A national ID the server will refuse is not worth a round
                // trip, so the button stays down until it is changed.
                onPressed: state.isBlocked ? null : _submit,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
