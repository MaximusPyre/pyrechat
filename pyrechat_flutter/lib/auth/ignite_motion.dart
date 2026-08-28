import 'package:flutter/material.dart';

/// Millisecond-timed ignite choreography (tap → split).
abstract final class IgniteMotion {
  static const totalMs = 1200;
  static const total = Duration(milliseconds: totalMs);
  static const soundDelayMs = 70;

  static double _ms(double t) => (t.clamp(0.0, 1.0)) * totalMs;

  /// 0ms → 92% by 70ms, expand to ~115% by 100ms, settle after.
  static double flameScale(double t) {
    final m = _ms(t);
    if (m <= 0) return 1;
    if (m < 70) return 1 - (m / 70) * 0.08;
    if (m < 100) return 0.92 + ((m - 70) / 30) * 0.23;
    if (m < 280) return 1.15 - ((m - 100) / 180) * 0.15;
    return 1.0;
  }

  static double flameStretchX(double t) {
    final m = _ms(t);
    if (m < 70 || m > 220) return 1;
    if (m < 100) return 1 + ((m - 70) / 30) * 0.1;
    return 1.1 - ((m - 100) / 120) * 0.1;
  }

  static double flameStretchY(double t) {
    final m = _ms(t);
    if (m < 70 || m > 220) return 1;
    if (m < 100) return 1 - ((m - 70) / 30) * 0.06;
    return 0.94 + ((m - 100) / 120) * 0.06;
  }

  /// Bright center flash peaking at 70ms.
  static double flashOpacity(double t) {
    final m = _ms(t);
    if (m < 35 || m > 170) return 0;
    if (m <= 70) return ((m - 35) / 35) * 0.92;
    return (1 - (m - 70) / 100) * 0.92;
  }

  /// Outward orange/yellow burst particles.
  static double particleOut(double t) {
    final m = _ms(t);
    if (m < 100) return 0;
    if (m > 680) return 1;
    return Curves.easeOutCubic.transform((m - 100) / 580);
  }

  /// Small embers drifting up.
  static double emberDrift(double t) {
    final m = _ms(t);
    if (m < 140) return 0;
    if (m > 920) return 1;
    return Curves.easeOut.transform((m - 140) / 780);
  }

  /// Two login/signup flames emerge from center.
  static double splitEmerge(double t) {
    final m = _ms(t);
    if (m < 720) return 0;
    if (m > 1180) return 1;
    return Curves.easeOutCubic.transform((m - 720) / 460);
  }

  static double centerFlameOpacity(double t) {
    final emerge = splitEmerge(t);
    if (emerge > 0) return (1 - emerge * 1.15).clamp(0.0, 1.0);
    final m = _ms(t);
    if (m > 520) return (1 - (m - 520) / 220).clamp(0.0, 1.0);
    return 1;
  }
}
