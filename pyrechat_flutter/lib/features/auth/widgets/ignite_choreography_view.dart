import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_burst_layout.dart';
import 'package:pyrechat_flutter/auth/ignite_motion.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/flame_auth_button.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

/// Tap-to-split choreography: compress → flash → burst → embers → twin flames.
class IgniteChoreographyView extends StatelessWidget {
  const IgniteChoreographyView({
    super.key,
    required this.t,
    required this.flame,
    required this.splitFlame,
    required this.center,
    required this.left,
    required this.right,
    required this.burstAngles,
    required this.sparkSeeds,
  });

  final double t;
  final double flame;
  final double splitFlame;
  final Offset center;
  final Offset left;
  final Offset right;
  final List<double> burstAngles;
  final List<double> sparkSeeds;

  @override
  Widget build(BuildContext context) {
    final scale = IgniteMotion.flameScale(t);
    final stretchX = IgniteMotion.flameStretchX(t);
    final stretchY = IgniteMotion.flameStretchY(t);
    final flash = IgniteMotion.flashOpacity(t);
    final particles = IgniteMotion.particleOut(t);
    final embers = IgniteMotion.emberDrift(t);
    final split = IgniteMotion.splitEmerge(t);
    final centerOpacity = IgniteMotion.centerFlameOpacity(t);

    return Stack(
      fit: StackFit.expand,
      children: [
        ..._burstParticles(particles),
        ..._risingEmbers(embers),
        if (flash > 0.01)
          Positioned(
            left: center.dx - flame * 0.75,
            top: center.dy - flame * 0.75,
            child: IgnorePointer(
              child: Container(
                width: flame * 1.5,
                height: flame * 1.5,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.white.withValues(alpha: flash),
                      PyreColors.emberSoft.withValues(alpha: flash * 0.45),
                      Colors.transparent,
                    ],
                    stops: const [0, 0.35, 1],
                  ),
                ),
              ),
            ),
          ),
        if (split > 0.01) ...[
          FlameAuthButton(
            label: 'Log in',
            position: Offset.lerp(center, left, split)!,
            size: splitFlame,
            opacity: split,
            onTap: null,
          ),
          FlameAuthButton(
            label: 'Sign up',
            position: Offset.lerp(center, right, split)!,
            size: splitFlame,
            opacity: split,
            onTap: null,
          ),
        ],
        if (centerOpacity > 0.01)
          Positioned(
            left: center.dx - flame / 2,
            top: center.dy - flame / 2,
            child: IgnorePointer(
              child: Opacity(
                opacity: centerOpacity,
                child: Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.diagonal3Values(scale * stretchX, scale * stretchY, 1),
                  child: PyreLogo(size: flame),
                ),
              ),
            ),
          ),
        for (var i = 0; i < AuthBurstLayout.burstCount; i++)
          if (particles > 0.05)
            _FlameShard(
              angle: burstAngles[i],
              progress: particles,
              origin: center,
              size: flame * (0.14 + (i % 3) * 0.05),
            ),
      ],
    );
  }

  List<Widget> _burstParticles(double progress) {
    if (progress <= 0) return const [];
    final rng = math.Random(7);
    return List.generate(18, (i) {
      final angle = (i / 18) * math.pi * 2 + rng.nextDouble() * 0.4;
      final dist = progress * (90 + (i % 5) * 22);
      final dx = center.dx + math.cos(angle) * dist;
      final dy = center.dy + math.sin(angle) * dist;
      final dot = 4.0 + (i % 4) * 2.2;
      final fade = (1 - progress * 0.85).clamp(0.0, 1.0);
      final warm = i.isEven ? PyreColors.emberSoft : const Color(0xFFFFE08A);
      return Positioned(
        left: dx - dot / 2,
        top: dy - dot / 2,
        child: Container(
          width: dot,
          height: dot,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: warm.withValues(alpha: fade * 0.9),
            boxShadow: [
              BoxShadow(
                color: PyreColors.ember.withValues(alpha: fade * 0.5),
                blurRadius: 6,
              ),
            ],
          ),
        ),
      );
    });
  }

  List<Widget> _risingEmbers(double progress) {
    if (progress <= 0) return const [];
    return List.generate(sparkSeeds.length, (i) {
      final seed = sparkSeeds[i];
      final x = center.dx + (seed - 0.5) * flame * 1.6;
      final rise = progress * (flame * 0.35 + (i % 4) * 12);
      final y = center.dy + flame * 0.15 - rise;
      final dot = 2.2 + (i % 3) * 1.1;
      final fade = (math.sin(progress * math.pi) * 0.7).clamp(0.0, 1.0);
      return Positioned(
        left: x,
        top: y,
        child: Container(
          width: dot,
          height: dot,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: PyreColors.paper.withValues(alpha: fade * 0.75),
            boxShadow: [
              BoxShadow(
                color: PyreColors.emberSoft.withValues(alpha: fade * 0.6),
                blurRadius: 5,
              ),
            ],
          ),
        ),
      );
    });
  }
}

class _FlameShard extends StatelessWidget {
  const _FlameShard({
    required this.angle,
    required this.progress,
    required this.origin,
    required this.size,
  });

  final double angle;
  final double progress;
  final Offset origin;
  final double size;

  @override
  Widget build(BuildContext context) {
    final radius = progress * 100;
    final dx = origin.dx + math.cos(angle) * radius - size / 2;
    final dy = origin.dy + math.sin(angle) * radius - size / 2;
    final opacity = (1 - progress * 0.75).clamp(0.0, 1.0);
    return Positioned(
      left: dx,
      top: dy,
      child: Opacity(
        opacity: opacity,
        child: PyreLogo(size: size),
      ),
    );
  }
}
