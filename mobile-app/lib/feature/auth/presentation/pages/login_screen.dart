import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/services/biometric/biometric_service.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/login/login_cubit.dart';
import 'package:machinery/feature/auth/data/logic/login/login_state.dart';
import 'package:machinery/feature/auth/presentation/widgets/biometric_enroll_sheet.dart';
import 'package:machinery/feature/auth/presentation/widgets/biometric_login_button.dart';
import 'package:machinery/feature/auth/presentation/widgets/login_form.dart';
import 'package:machinery/feature/auth/presentation/widgets/login_header.dart';
import 'package:machinery/feature/splash/presentation/widgets/language_toggle_button.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final BiometricService _biometricService = getIt<BiometricService>();

  bool _isBiometricAvailable = false;
  bool _isBiometricRunning = false;

  /// The enrolment sheet is offered once per visit to this screen, so a failed
  /// navigation cannot re-open it on the next rebuild.
  bool _hasOfferedBiometricEnrollment = false;

  bool get _isLoginEnabled {
    return AppValidators.isValidEgyptianPhone(_phoneController.text) == null &&
        AppValidators.isValidPassword(_passwordController.text) == null;
  }

  @override
  void initState() {
    super.initState();
    _resolveBiometricAvailability();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _resolveBiometricAvailability() async {
    final bool isEnabled = await _biometricService.isLoginEnabled();
    if (mounted) {
      setState(() => _isBiometricAvailable = isEnabled);
    }
  }

  void _onFormChanged() => setState(() {});

  void _onLoginPressed() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    context.read<LoginCubit>().login(
      phone: _phoneController.text.trim(),
      password: _passwordController.text,
    );
  }

  /// Biometrics unlock the refresh token already on this device, so a pass
  /// just re-runs the normal session check.
  Future<void> _onBiometricPressed() async {
    setState(() => _isBiometricRunning = true);

    final bool didPass = await _biometricService.authenticate();

    if (!mounted) {
      return;
    }

    setState(() => _isBiometricRunning = false);

    if (!didPass) {
      showErrorToast(LocaleKeys.biometricFailed.tr(), context);
      return;
    }

    await getIt<AuthCubit>().checkSession();

    if (mounted) {
      AppRoute.goToAuthGate(context: context);
    }
  }

  Future<void> _onLoginSucceeded(LoginState state) async {
    if (state is! LoginSuccess) {
      return;
    }

    if (state.mustChangePassword) {
      AppRoute.goToChangePasswordScreen(context: context, isForced: true);
      return;
    }

    await _offerBiometricEnrollment();

    if (mounted) {
      AppRoute.goToMainScaffold(context: context);
    }
  }

  Future<void> _offerBiometricEnrollment() async {
    if (_hasOfferedBiometricEnrollment) {
      return;
    }
    if (!await _biometricService.isAvailable() || !mounted) {
      return;
    }

    _hasOfferedBiometricEnrollment = true;

    final bool accepted = await BiometricEnrollSheet.show(context);
    if (accepted) {
      await _biometricService.setLoginEnabled(isEnabled: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<LoginCubit, LoginState>(
      listener: (context, state) {
        if (state is LoginFailure) {
          showErrorToast(state.errorMessage, context);
        }
        if (state is LoginSuccess) {
          _onLoginSucceeded(state);
        }
      },
      builder: (context, state) {
        final bool isLoading = state is LoginLoading;
        final Map<String, String> fieldErrors = state is LoginFailure
            ? state.fieldErrors
            : const <String, String>{};

        return Scaffold(
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: LanguageToggleButton(),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    const LoginHeader(),
                    const SizedBox(height: AppSpacing.xl),
                    LoginForm(
                      phoneController: _phoneController,
                      passwordController: _passwordController,
                      fieldErrors: fieldErrors,
                      onChanged: _onFormChanged,
                      onSubmitted: _onLoginPressed,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    CustomButton(
                      title: LocaleKeys.login.tr(),
                      isLoading: isLoading,
                      onPressed: _isLoginEnabled ? _onLoginPressed : null,
                      identifier: 'login_submit_button',
                    ),
                    if (_isBiometricAvailable) ...<Widget>[
                      const SizedBox(height: AppSpacing.md),
                      BiometricLoginButton(
                        isLoading: _isBiometricRunning,
                        onPressed: _onBiometricPressed,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      LocaleKeys.firstLoginNeedsInternet.tr(),
                      style: Styles.s12(
                        context,
                      ).copyWith(color: AppColors.textSecondaryColor),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
