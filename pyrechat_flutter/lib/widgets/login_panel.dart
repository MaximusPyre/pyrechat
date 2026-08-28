import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';

class LoginPanel extends StatelessWidget {
  const LoginPanel({
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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Welcome back',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: PyreColors.onPaper,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Log in to capture and send Pyres.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: PyreColors.onPaperMuted.withValues(alpha: 0.95),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 28),
          TextField(
            onChanged: onUsernameChanged,
            style: const TextStyle(color: PyreColors.onPaper),
            textInputAction: TextInputAction.next,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Username',
              filled: true,
              fillColor: PyreColors.paperDim,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            onChanged: onPasswordChanged,
            obscureText: true,
            style: const TextStyle(color: PyreColors.onPaper),
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => onSubmit(),
            decoration: InputDecoration(
              labelText: 'Password',
              filled: true,
              fillColor: PyreColors.paperDim,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          if (error != null && error!.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: PyreColors.errorOnPaper, fontSize: 13),
            ),
          ],
          const SizedBox(height: 22),
          FilledButton(
            onPressed: busy ? null : onSubmit,
            style: FilledButton.styleFrom(
              backgroundColor: PyreColors.ember,
              foregroundColor: PyreColors.paper,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: busy
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: PyreColors.paper,
                    ),
                  )
                : const Text(
                    'Log in',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
          ),
        ],
      ),
    );
  }
}
