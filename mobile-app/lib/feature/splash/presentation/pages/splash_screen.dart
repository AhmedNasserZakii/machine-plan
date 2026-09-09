import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_state.dart';
import 'package:machinery/feature/splash/presentation/widgets/splash_logo.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolveSession());
  }

  /// Routes off the awaited result rather than off a state *change*.
  ///
  /// `AuthCubit` is a singleton, so re-entering splash — after a language
  /// switch rebuilds the navigator, for instance — can settle on the same
  /// state it already held. Cubit suppresses an identical emit, so a listener
  /// would never fire and splash would sit here forever.
  Future<void> _resolveSession() async {
    final AuthCubit authCubit = context.read<AuthCubit>();

    await authCubit.checkSession();

    if (!mounted) {
      return;
    }

    final AuthState state = authCubit.state;

    if (state is Authenticated) {
      if (state.mustChangePassword) {
        AppRoute.goToChangePasswordScreen(context: context, isForced: true);
      } else {
        AppRoute.goToMainScaffold(context: context);
      }
      return;
    }

    AppRoute.goToLoginScreen(context: context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Spacer(),
            const SplashLogo(),
            const SizedBox(height: AppSpacing.sm),
            Text(
              LocaleKeys.loginSubtitle.tr(),
              textAlign: TextAlign.center,
              style: Styles.s14(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
            const Spacer(),
            const AppLoadingIndicator(size: 32),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}
