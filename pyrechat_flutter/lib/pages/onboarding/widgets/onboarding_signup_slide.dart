import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_form_state.dart';
import 'package:pyrechat_flutter/auth/signup_step.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/signup_question.dart';

/// Nested [PageView] for signup questions — parent onboarding page stays one route.
class OnboardingSignupSlide extends StatefulWidget {
  const OnboardingSignupSlide({
    super.key,
    required this.forms,
    required this.onChanged,
    required this.onSubmit,
  });

  final AuthFormState forms;
  final VoidCallback onChanged;
  final VoidCallback onSubmit;

  @override
  State<OnboardingSignupSlide> createState() => OnboardingSignupSlideState();
}

class OnboardingSignupSlideState extends State<OnboardingSignupSlide> {
  final _stepController = PageController();
  static const _steps = SignupStep.values;

  @override
  void dispose() {
    _stepController.dispose();
    super.dispose();
  }

  void resetToFirstStep() {
    widget.forms.signupStep = SignupStep.displayName;
    if (_stepController.hasClients) {
      _stepController.jumpToPage(0);
    }
  }

  Future<void> _goToStep(SignupStep step) async {
    final index = _steps.indexOf(step);
    widget.forms.signupStep = step;
    widget.onChanged();
    if (!_stepController.hasClients) return;
    await _stepController.animateToPage(
      index,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeInOutCubic,
    );
  }

  Future<bool> handleBack() async {
    final prev = widget.forms.signupStep.previous;
    if (prev == null) return false;
    await _goToStep(prev);
    return true;
  }

  void _onNext() {
    final next = widget.forms.signupStep.next;
    if (next != null) {
      widget.forms.signupError = null;
      _goToStep(next);
      return;
    }
    widget.onSubmit();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: PyreColors.ember,
      child: PageView(
        controller: _stepController,
        physics: const NeverScrollableScrollPhysics(),
        onPageChanged: (index) {
          widget.forms.signupStep = _steps[index];
          widget.onChanged();
        },
        children: [for (final step in _steps) _stepPage(step)],
      ),
    );
  }

  Widget _stepPage(SignupStep step) {
    final f = widget.forms;
    switch (step) {
      case SignupStep.displayName:
        return SignupQuestion(
          title: step.title,
          subtitle: step.subtitle,
          error: f.signupError,
          busy: f.signupBusy,
          nextEnabled: f.displayName.trim().isNotEmpty,
          onNext: _onNext,
          input: _field(
            value: f.displayName,
            hint: 'Your name',
            onChanged: (v) {
              f.displayName = v;
              widget.onChanged();
            },
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => _onNext(),
          ),
        );
      case SignupStep.username:
        return SignupQuestion(
          title: step.title,
          subtitle: step.subtitle,
          error: f.signupError,
          busy: f.signupBusy,
          nextEnabled: f.signupUsername.trim().length >= 3,
          onNext: _onNext,
          input: _field(
            value: f.signupUsername,
            hint: 'username',
            onChanged: (v) {
              f.signupUsername = v;
              widget.onChanged();
            },
            autocorrect: false,
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => _onNext(),
          ),
        );
      case SignupStep.birthday:
        return SignupQuestion(
          title: step.title,
          subtitle: step.subtitle,
          error: f.signupError,
          busy: f.signupBusy,
          nextEnabled: f.birthday.trim().isNotEmpty,
          onNext: _onNext,
          input: _field(
            value: f.birthday,
            hint: 'YYYY-MM-DD',
            onChanged: (v) {
              f.birthday = v;
              widget.onChanged();
            },
            keyboardType: TextInputType.datetime,
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => _onNext(),
          ),
        );
      case SignupStep.password:
        return SignupQuestion(
          title: step.title,
          subtitle: step.subtitle,
          error: f.signupError,
          busy: f.signupBusy,
          nextEnabled: f.signupPassword.length >= 8,
          onNext: _onNext,
          input: _field(
            value: f.signupPassword,
            hint: 'Password',
            onChanged: (v) {
              f.signupPassword = v;
              widget.onChanged();
            },
            obscureText: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _onNext(),
          ),
        );
    }
  }

  Widget _field({
    required String value,
    required String hint,
    required ValueChanged<String> onChanged,
    bool obscureText = false,
    bool autocorrect = true,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    ValueChanged<String>? onSubmitted,
  }) {
    return TextFormField(
      initialValue: value,
      onChanged: onChanged,
      obscureText: obscureText,
      autocorrect: autocorrect,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onFieldSubmitted: onSubmitted,
      style: const TextStyle(color: PyreColors.onPaper, fontSize: 18),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: PyreColors.hintOnPaper),
        filled: true,
        fillColor: PyreColors.paper,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: PyreColors.onPaper.withValues(alpha: 0.08)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: PyreColors.onPaper, width: 1.5),
        ),
      ),
    );
  }
}
