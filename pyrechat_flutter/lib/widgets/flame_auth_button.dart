import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

class FlameAuthButton extends StatelessWidget {
  const FlameAuthButton({
    super.key,
    required this.label,
    required this.position,
    required this.size,
    this.scale = 1,
    this.opacity = 1,
    this.labelOpacity = 1,
    this.showLabel = true,
    this.onTap,
  });

  final String label;
  final Offset position;
  final double size;
  final double scale;
  final double opacity;
  final double labelOpacity;
  final bool showLabel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tappable = onTap != null && opacity > 0.2;
    final hitWidth = size + 24;

    // [position] is the flame center — labels hang below without shifting the flame.
    return Positioned(
      left: position.dx - hitWidth / 2,
      top: position.dy - size / 2,
      child: Semantics(
        button: true,
        label: label,
        enabled: tappable,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: tappable
              ? () {
                  HapticFeedback.selectionClick();
                  onTap?.call();
                }
              : null,
          child: Align(
            alignment: Alignment.topCenter,
            child: Transform.scale(
              scale: scale,
              alignment: Alignment.topCenter,
              child: Opacity(
                opacity: opacity.clamp(0.0, 1.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PyreLogo(size: size),
                    if (showLabel) ...[
                      const SizedBox(height: 10),
                      Opacity(
                        opacity: labelOpacity.clamp(0.0, 1.0),
                        child: Text(
                          label,
                          style: TextStyle(
                            color: PyreColors.paper,
                            fontSize: size * 0.13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
