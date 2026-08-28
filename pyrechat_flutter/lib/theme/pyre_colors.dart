import 'package:flutter/material.dart';

/// Central palette — edit tokens here to restyle the app.
abstract final class PyreColors {
  // ── Brand ────────────────────────────────────────────────────────────────
  static const ember = Color(0xFFFC7A1A);
  static const emberSoft = Color(0xFFFFB056);

  // ── Surfaces ─────────────────────────────────────────────────────────────
  static const ink = Color(0xFF140E0B);
  static const panel = Color(0xFF1F1612);
  static const paper = Color(0xFFFBF6F0);
  static const paperDim = Color(0xFFF5F0EA);

  // ── Text on dark / panel surfaces ────────────────────────────────────────
  static const mute = Color(0xFFC4A48E);

  // ── Text on ember (signup, onboarding flames) — higher contrast ──────────
  static const onEmber = paper;
  static const onEmberSubtitle = Color(0xFF3A2514);
  static const onEmberError = Color(0xFF4A0E04);

  // ── Text on light surfaces (login form, inputs) ────────────────────────────
  static const onPaper = ink;
  static const onPaperMuted = Color(0xFF6B5346);
  static const hintOnPaper = Color(0xFF8A7262);

  // ── Semantic ─────────────────────────────────────────────────────────────
  static const error = Color(0xFFFF8A70);
  static const errorOnPaper = Color(0xFFB3261E);

  // ── Effects ──────────────────────────────────────────────────────────────
  static const sheenHighlight = Color(0xFFFFF4E8);
  static const dialogScrim = Color(0xB8140E0B); // ink @ ~72%
}
