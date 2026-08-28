import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_form_state.dart';
import 'package:pyrechat_flutter/models/user.dart';
import 'package:pyrechat_flutter/pages/onboarding/widgets/fade_page_view.dart';
import 'package:pyrechat_flutter/pages/onboarding/widgets/onboarding_choice_slide.dart';
import 'package:pyrechat_flutter/pages/onboarding/widgets/onboarding_intro_slide.dart';
import 'package:pyrechat_flutter/pages/onboarding/widgets/onboarding_login_slide.dart';
import 'package:pyrechat_flutter/pages/onboarding/widgets/onboarding_signup_slide.dart';
import 'package:pyrechat_flutter/screens/app_shell_screen.dart';
import 'package:pyrechat_flutter/services/pyre_api.dart';
import 'package:pyrechat_flutter/services/session_store.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/leave_app_dialog.dart';

/// Single onboarding host (FlutterFlow-style): one page, cross-fading steps.
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  static const _intro = 0;
  static const _choice = 1;
  static const _login = 2;
  static const _signup = 3;

  final _forms = AuthFormState();
  final _api = PyreApi();
  final _session = SessionStore();

  int _page = _intro;
  final _signupKey = GlobalKey<OnboardingSignupSlideState>();
  final _choiceKey = GlobalKey<OnboardingChoiceSlideState>();

  void _goTo(int index) {
    if (index == _page) return;
    setState(() => _page = index);
  }

  void _enterApp(PyreUser user) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => AppShellScreen(user: user)),
    );
  }

  Future<void> _submitLogin() async {
    if (_forms.loginBusy) return;
    final user = _forms.username.trim();
    if (user.isEmpty || _forms.password.isEmpty) {
      setState(() => _forms.loginError = 'Enter username and password');
      return;
    }
    setState(() {
      _forms.loginBusy = true;
      _forms.loginError = null;
    });
    try {
      final result = await _api.login(
        username: user,
        password: _forms.password,
      );
      await _session.save(token: result.token, user: result.user);
      if (!mounted) return;
      _enterApp(result.user);
    } on PyreApiException catch (e) {
      setState(() => _forms.loginError = e.message);
    } catch (_) {
      setState(() => _forms.loginError = 'Could not log in');
    } finally {
      if (mounted) setState(() => _forms.loginBusy = false);
    }
  }

  Future<void> _submitSignup() async {
    if (_forms.signupBusy) return;
    setState(() {
      _forms.signupBusy = true;
      _forms.signupError = null;
    });
    try {
      final result = await _api.signup(
        username: _forms.signupUsername.trim(),
        password: _forms.signupPassword,
        displayName: _forms.displayName.trim(),
        birthday: _forms.birthday.trim(),
      );
      await _session.save(token: result.token, user: result.user);
      if (!mounted) return;
      _enterApp(result.user);
    } on PyreApiException catch (e) {
      setState(() => _forms.signupError = e.message);
    } catch (_) {
      setState(() => _forms.signupError = 'Could not sign up');
    } finally {
      if (mounted) setState(() => _forms.signupBusy = false);
    }
  }

  void _openSignup() {
    _forms.resetSignup();
    _signupKey.currentState?.resetToFirstStep();
    _goTo(_signup);
  }

  Future<void> _handleBack() async {
    if (_page == _intro) {
      if (!mounted) return;
      await maybeLeaveApp(context);
      return;
    }
    if (_page == _signup) {
      final handled = await _signupKey.currentState?.handleBack() ?? false;
      if (handled) return;
      _goTo(_choice);
      return;
    }
    if (_page == _login) {
      _goTo(_choice);
      return;
    }
    if (_page == _choice) {
      final collapsed = await _choiceKey.currentState?.collapseToIdle() ?? false;
      if (collapsed) return;
      if (!mounted) return;
      await maybeLeaveApp(context);
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: Scaffold(
        backgroundColor: PyreColors.ember,
        body: FadePageView(
          index: _page,
          duration: onboardingDissolveDuration,
          curve: onboardingDissolveCurve,
          children: [
            OnboardingIntroSlide(onFinished: () => _goTo(_choice)),
            OnboardingChoiceSlide(
              key: _choiceKey,
              onLogin: () => _goTo(_login),
              onSignup: _openSignup,
            ),
            OnboardingLoginSlide(
              username: _forms.username,
              password: _forms.password,
              busy: _forms.loginBusy,
              error: _forms.loginError,
              onUsernameChanged: (v) => setState(() => _forms.username = v),
              onPasswordChanged: (v) => setState(() => _forms.password = v),
              onSubmit: _submitLogin,
            ),
            OnboardingSignupSlide(
              key: _signupKey,
              forms: _forms,
              onChanged: () => setState(() {}),
              onSubmit: _submitSignup,
            ),
          ],
        ),
      ),
    );
  }
}
