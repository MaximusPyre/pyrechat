import 'package:flutter/material.dart';

import 'package:pyrechat_flutter/theme/pyre_colors.dart';

export 'pyre_colors.dart';

ThemeData pyreTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: PyreColors.ember,
    colorScheme: const ColorScheme.dark(
      primary: PyreColors.ember,
      secondary: PyreColors.emberSoft,
      surface: PyreColors.panel,
      onPrimary: PyreColors.paper,
      onSurface: PyreColors.paper,
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: PyreColors.paper,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.5,
      ),
      titleMedium: TextStyle(
        color: PyreColors.paper,
        fontWeight: FontWeight.w700,
      ),
      bodyMedium: TextStyle(color: PyreColors.mute),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: PyreColors.ink.withValues(alpha: 0.35),
      hintStyle: const TextStyle(color: PyreColors.mute),
      labelStyle: const TextStyle(color: PyreColors.mute),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: PyreColors.paper.withValues(alpha: 0.12)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: PyreColors.paper.withValues(alpha: 0.12)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: PyreColors.paper, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    ),
  );
}
