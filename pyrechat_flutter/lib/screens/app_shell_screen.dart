import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/models/user.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

/// Placeholder shell after auth — main tabs land here next.
class AppShellScreen extends StatelessWidget {
  const AppShellScreen({super.key, required this.user});

  final PyreUser user;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PyreColors.ink,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const PyreLogo(size: 96),
                const SizedBox(height: 24),
                Text(
                  'Welcome, ${user.displayName}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: PyreColors.paper,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '@${user.username}',
                  style: const TextStyle(color: PyreColors.mute, fontSize: 16),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Capture, inbox, and profile tabs are coming next.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: PyreColors.mute, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
