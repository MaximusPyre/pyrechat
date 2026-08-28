import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';

/// Confirms before closing the app from onboarding.
Future<bool> confirmLeaveApp(BuildContext context) async {
  final leave = await showDialog<bool>(
    context: context,
    barrierColor: PyreColors.dialogScrim,
    builder: (context) => AlertDialog(
      backgroundColor: PyreColors.panel,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      title: const Text(
        'Leave PyreChat?',
        style: TextStyle(
          color: PyreColors.paper,
          fontWeight: FontWeight.w800,
        ),
      ),
      content: const Text(
        'Are you sure you want to leave?',
        style: TextStyle(color: PyreColors.mute),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text(
            'Stay',
            style: TextStyle(
              color: PyreColors.paper,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text(
            'Leave',
            style: TextStyle(
              color: PyreColors.ember,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    ),
  );
  return leave == true;
}

Future<void> maybeLeaveApp(BuildContext context) async {
  if (!context.mounted) return;
  if (await confirmLeaveApp(context) && context.mounted) {
    SystemNavigator.pop();
  }
}
