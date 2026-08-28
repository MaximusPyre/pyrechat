import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

class BurstEmber extends StatelessWidget {
  const BurstEmber({
    super.key,
    required this.angle,
    required this.progress,
    required this.fade,
    required this.origin,
    required this.size,
  });

  final double angle;
  final double progress;
  final double fade;
  final Offset origin;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (progress <= 0) return const SizedBox.shrink();
    final radius = progress * 120;
    final dx = origin.dx + math.cos(angle) * radius - size / 2;
    final dy = origin.dy + math.sin(angle) * radius - size / 2;
    final opacity = ((1 - progress) * (1 - fade)).clamp(0.0, 1.0);
    return Positioned(
      left: dx,
      top: dy,
      child: Transform.rotate(
        angle: angle * 0.2,
        child: Transform.scale(
          scale: 0.55 + progress * 0.65,
          child: PyreLogo(size: size, opacity: opacity),
        ),
      ),
    );
  }
}
