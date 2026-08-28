import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';

class SignupQuestion extends StatelessWidget {
  const SignupQuestion({
    super.key,
    required this.title,
    this.subtitle,
    required this.input,
    required this.onNext,
    this.nextEnabled = true,
    this.busy = false,
    this.error,
  });

  final String title;
  final String? subtitle;
  final Widget input;
  final VoidCallback onNext;
  final bool nextEnabled;
  final bool busy;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 34,
                fontWeight: FontWeight.w900,
                color: PyreColors.onEmber,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                style: const TextStyle(
                  fontSize: 16,
                  color: PyreColors.onEmberSubtitle,
                ),
              ),
            ],
            if (error != null && error!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                error!,
                style: const TextStyle(
                  color: PyreColors.onEmberError,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 32),
            input,
            const SizedBox(height: 32),
            Align(
              alignment: Alignment.centerRight,
              child: IconButton.filled(
                onPressed: nextEnabled && !busy ? onNext : null,
                style: IconButton.styleFrom(
                  backgroundColor: PyreColors.paper,
                  foregroundColor: PyreColors.onPaper,
                  disabledBackgroundColor: PyreColors.paper.withValues(alpha: 0.45),
                  disabledForegroundColor: PyreColors.onPaper.withValues(alpha: 0.35),
                ),
                icon: busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: PyreColors.ember,
                        ),
                      )
                    : const Icon(Icons.arrow_forward_rounded),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
