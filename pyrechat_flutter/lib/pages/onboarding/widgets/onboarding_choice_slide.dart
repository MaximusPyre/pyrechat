import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pyrechat_flutter/auth/auth_motion.dart';
import 'package:pyrechat_flutter/features/auth/widgets/idle_flame_view.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

/// Log in / Sign up choice. Split dissolve is a local effect — taps go to parent pages.
class OnboardingChoiceSlide extends StatefulWidget {
  const OnboardingChoiceSlide({
    super.key,
    required this.onLogin,
    required this.onSignup,
  });

  final VoidCallback onLogin;
  final VoidCallback onSignup;

  @override
  State<OnboardingChoiceSlide> createState() => OnboardingChoiceSlideState();
}

class OnboardingChoiceSlideState extends State<OnboardingChoiceSlide>
    with SingleTickerProviderStateMixin {
  static const _splitDuration = Duration(milliseconds: 1400);

  late final AnimationController _split;

  @override
  void initState() {
    super.initState();
    _split = AnimationController(vsync: this, duration: _splitDuration);
  }

  @override
  void dispose() {
    _split.dispose();
    super.dispose();
  }

  void _ignite() {
    if (_split.isAnimating || _split.value >= 1) return;
    _split.forward();
  }

  /// Collapse Log in / Sign up back to the single idle flame. Returns true if handled.
  Future<bool> collapseToIdle() async {
    if (_split.value <= 0.001) return false;
    await _split.animateTo(
      0,
      duration: AuthMotion.backDuration,
      curve: AuthMotion.back,
    );
    return true;
  }

  bool get showsSplit => _split.value > 0.001 || _split.isAnimating;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final flame = size.shortestSide * 0.38;
    final splitFlame = size.shortestSide * 0.28;
    final center = Offset(size.width * 0.5, size.height * 0.5);

    return ColoredBox(
      color: PyreColors.ember,
      child: AnimatedBuilder(
        animation: _split,
        builder: (context, _) {
          final t = _split.value;
          if (!showsSplit) {
            return IdleFlameView(
              flame: flame,
              center: center,
              onIgnite: _ignite,
            );
          }

          final separate = AuthMotion.phase(t, 0.18, 0.78, AuthMotion.flow);
          final shrink = AuthMotion.phase(t, 0.32, 0.92, AuthMotion.flow);
          final flameSize = flame + (splitFlame - flame) * shrink;
          final spread = (flameSize * 0.74 + 18) * separate;

          return Stack(
            fit: StackFit.expand,
            clipBehavior: Clip.none,
            children: [
              _SplitFlame(
                center: Offset(center.dx - spread, center.dy),
                size: flameSize,
                kind: PyreFlameKind.signIn,
                onTap: widget.onLogin,
              ),
              _SplitFlame(
                center: Offset(center.dx + spread, center.dy),
                size: flameSize,
                kind: PyreFlameKind.signUp,
                onTap: widget.onSignup,
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Same layout as [IdleFlameView]'s flame: centered on [center], no label.
class _SplitFlame extends StatelessWidget {
  const _SplitFlame({
    required this.center,
    required this.size,
    required this.onTap,
    required this.kind,
  });

  final Offset center;
  final double size;
  final VoidCallback onTap;
  final PyreFlameKind kind;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: center.dx - size / 2,
      top: center.dy - size / 2,
      child: Semantics(
        button: true,
        enabled: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: PyreLogo(size: size, kind: kind),
        ),
      ),
    );
  }
}
