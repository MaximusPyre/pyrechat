import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/animation_interval.dart';

/// Shared motion language for the auth flow — curves, durations, easing helpers.
abstract final class AuthMotion {
  /// Every forward auth channel transition uses this duration.
  static const Duration duration = Duration(milliseconds: 3000);

  /// Back gestures — snappier so it doesn't feel stuck.
  static const Duration backDuration = Duration(milliseconds: 1500);

  /// Primary transitions — soft acceleration, long deceleration.
  static const Curve flow = Curves.easeInOutCubicEmphasized;

  /// Elements entering the screen.
  static const Curve enter = Curves.easeOutCubic;

  /// Elements leaving / dissolving.
  static const Curve exit = Curves.easeInCubic;

  /// Back navigation — moves immediately, eases to rest.
  static const Curve back = Curves.easeOutCubic;

  /// Zoom / scale moments (same speed, slightly different ease).
  static const Curve zoomCurve = Curves.easeInOutCubicEmphasized;

  /// Maps [t] through [start, end] with smoothstep (no linear segment kinks).
  static double phase(double t, double start, double end, [Curve curve = Curves.linear]) {
    final raw = animationInterval(t, start, end);
    final smooth = raw * raw * (3 - 2 * raw);
    return curve.transform(smooth);
  }
}
