import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/signup_step.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/signup_question.dart';

class SignupFlowPanel extends StatelessWidget {
  const SignupFlowPanel({
    super.key,
    required this.step,
    required this.displayName,
    required this.username,
    required this.birthday,
    required this.password,
    required this.onDisplayNameChanged,
    required this.onUsernameChanged,
    required this.onBirthdayChanged,
    required this.onPasswordChanged,
    required this.onNext,
    required this.busy,
    this.error,
  });

  final SignupStep step;
  final String displayName;
  final String username;
  final String birthday;
  final String password;
  final ValueChanged<String> onDisplayNameChanged;
  final ValueChanged<String> onUsernameChanged;
  final ValueChanged<String> onBirthdayChanged;
  final ValueChanged<String> onPasswordChanged;
  final VoidCallback onNext;
  final bool busy;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, animation) {
        final slide = Tween<Offset>(
          begin: const Offset(0.08, 0),
          end: Offset.zero,
        ).animate(animation);
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: slide, child: child),
        );
      },
      child: KeyedSubtree(
        key: ValueKey(step),
        child: _buildStep(context),
      ),
    );
  }

  Widget _buildStep(BuildContext context) {
    switch (step) {
      case SignupStep.displayName:
        return SignupQuestion(
          title: step.title,
          subtitle: step.subtitle,
          error: error,
          busy: busy,
          nextEnabled: displayName.trim().isNotEmpty,
          onNext: onNext,
          input: _field(
            value: displayName,
            hint: 'Your name',
            onChanged: onDisplayNameChanged,
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => onNext(),
          ),
        );
      case SignupStep.username:
        return SignupQuestion(
          title: step.title,
          subtitle: step.subtitle,
          error: error,
          busy: busy,
          nextEnabled: username.trim().length >= 3,
          onNext: onNext,
          input: _field(
            value: username,
            hint: 'username',
            onChanged: onUsernameChanged,
            autocorrect: false,
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => onNext(),
          ),
        );
      case SignupStep.birthday:
        return SignupQuestion(
          title: step.title,
          subtitle: step.subtitle,
          error: error,
          busy: busy,
          nextEnabled: birthday.trim().isNotEmpty,
          onNext: onNext,
          input: _field(
            value: birthday,
            hint: 'YYYY-MM-DD',
            onChanged: onBirthdayChanged,
            keyboardType: TextInputType.datetime,
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => onNext(),
          ),
        );
      case SignupStep.password:
        return SignupQuestion(
          title: step.title,
          subtitle: step.subtitle,
          error: error,
          busy: busy,
          nextEnabled: password.length >= 8,
          onNext: onNext,
          input: _field(
            value: password,
            hint: 'Password',
            onChanged: onPasswordChanged,
            obscureText: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => onNext(),
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
      ),
    );
  }
}
