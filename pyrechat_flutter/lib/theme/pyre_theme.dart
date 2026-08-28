import 'package:flutter/material.dart';

abstract final class PyreColors {
  static const ember = Color(0xFFFC7A1A);
  static const emberSoft = Color(0xFFFFB056);
  static const ink = Color(0xFF140E0B);
  static const panel = Color(0xFF1F1612);
  static const paper = Color(0xFFFBF6F0);
  static const mute = Color(0xFFC4A48E);
  static const error = Color(0xFFFF8A70);
}

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
