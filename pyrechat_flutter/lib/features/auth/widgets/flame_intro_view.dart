import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_motion.dart';
import 'package:pyrechat_flutter/auth/auth_burst_layout.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

class FlameIntroView extends StatelessWidget {
  const FlameIntroView({
    super.key,
    required this.introT,
    required this.flame,
    required this.center,
    required this.size,
    required this.sparkSeeds,
  });

  final double introT;
  final double flame;
  final Offset center;
  final Size size;
  final List<double> sparkSeeds;

  @override
  Widget build(BuildContext context) {
    final glow = AuthMotion.phase(introT, 0.06, 0.88, AuthMotion.enter);
    final flameIn = AuthMotion.phase(introT, 0.0, 0.62, AuthMotion.enter);
    final settle = AuthMotion.phase(introT, 0.5, 1.0, AuthMotion.flow);
    final flameScale = (0.9 + flameIn * 0.1) * (0.98 + settle * 0.02);
    final flameOpacity =
        AuthMotion.phase(introT, 0.0, 0.22, AuthMotion.enter).clamp(0.92, 1.0);

    return ColoredBox(
      color: PyreColors.ember,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Center(
            child: Transform.scale(
              scale: 0.55 + glow * 1.15,
              child: Container(
                width: size.shortestSide * 0.95,
                height: size.shortestSide * 0.95,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      PyreColors.emberSoft.withValues(alpha: glow * 0.42),
                      PyreColors.ember.withValues(alpha: glow * 0.18),
                      Colors.transparent,
                    ],
                    stops: const [0, 0.45, 1],
                  ),
                ),
              ),
            ),
          ),
          for (var i = 0; i < AuthBurstLayout.sparkCount; i++)
            _spark(size, introT, sparkSeeds[i], i),
          Positioned(
            left: center.dx - flame / 2,
            top: center.dy - flame / 2,
            child: Transform.scale(
              scale: flameScale,
              child: PyreLogo(size: flame, opacity: flameOpacity),
            ),
          ),
        ],
      ),
    );
  }

  Widget _spark(Size size, double t, double seed, int index) {
    final start = 0.18 + seed * 0.35;
    final life = AuthMotion.phase(t, start, 0.95, AuthMotion.enter);
    if (life <= 0) return const SizedBox.shrink();

    final x = size.width * (0.12 + seed * 0.76);
    final rise = life * size.height * (0.18 + (index % 4) * 0.04);
    final y = size.height * 0.78 - rise;
    final dot = 3.0 + (index % 3) * 1.6;
    final opacity = (math.sin(life * math.pi) * 0.65).clamp(0.0, 1.0);

    return Positioned(
      left: x,
      top: y,
      child: Container(
        width: dot,
        height: dot,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: PyreColors.paper.withValues(alpha: opacity),
          boxShadow: [
            BoxShadow(
              color: PyreColors.emberSoft.withValues(alpha: opacity * 0.8),
              blurRadius: 8,
            ),
          ],
        ),
      ),
    );
  }
}
