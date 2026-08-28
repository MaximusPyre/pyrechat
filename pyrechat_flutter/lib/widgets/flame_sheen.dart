import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/theme/pyre_colors.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

/// Glossy highlight sweep over the flame asset.
class FlameSheen extends StatelessWidget {
  const FlameSheen({
    super.key,
    required this.size,
    required this.sheenT,
    this.opacity = 1,
    this.intensity = 0.4,
  });

  final double size;
  /// 0–1 position of the highlight sweep during a flash.
  final double sheenT;
  final double opacity;
  final double intensity;

  @override
  Widget build(BuildContext context) {
    if (intensity <= 0.001) {
      return PyreLogo(size: size, opacity: opacity);
    }

    final sweep = sheenT * 3.4 - 1.3;

    return SizedBox(
      width: size,
      height: size,
      child: ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) {
          return LinearGradient(
            begin: Alignment(sweep - 1.0, -0.85),
            end: Alignment(sweep + 0.35, 0.85),
            colors: [
              Colors.transparent,
              Colors.white.withValues(alpha: 0),
              Colors.white.withValues(alpha: intensity * 0.45),
              PyreColors.sheenHighlight.withValues(alpha: intensity),
              Colors.white.withValues(alpha: intensity * 0.35),
              Colors.transparent,
            ],
            stops: const [0.0, 0.34, 0.44, 0.5, 0.58, 0.78],
          ).createShader(bounds);
        },
        child: PyreLogo(size: size, opacity: opacity),
      ),
    );
  }
}
