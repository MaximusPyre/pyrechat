import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/widgets/login_panel.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

class OnboardingLoginSlide extends StatelessWidget {
  const OnboardingLoginSlide({
    super.key,
    required this.username,
    required this.password,
    required this.onUsernameChanged,
    required this.onPasswordChanged,
    required this.onSubmit,
    required this.busy,
    this.error,
  });

  final String username;
  final String password;
  final ValueChanged<String> onUsernameChanged;
  final ValueChanged<String> onPasswordChanged;
  final VoidCallback onSubmit;
  final bool busy;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final flame = MediaQuery.sizeOf(context).shortestSide * 0.22;

    return ColoredBox(
      color: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 24),
            PyreLogo(size: flame),
            const Spacer(),
            LoginPanel(
              username: username,
              password: password,
              onUsernameChanged: onUsernameChanged,
              onPasswordChanged: onPasswordChanged,
              onSubmit: onSubmit,
              busy: busy,
              error: error,
            ),
            const Spacer(flex: 2),
          ],
        ),
      ),
    );
  }
}
