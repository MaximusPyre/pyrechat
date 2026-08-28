import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_burst_layout.dart';
import 'package:pyrechat_flutter/auth/auth_motion.dart';
import 'package:pyrechat_flutter/features/auth/widgets/flame_intro_view.dart';
import 'package:pyrechat_flutter/utils/motion_prefs.dart';

/// Intro effect only — advances parent [PageView] when the animation completes.
class OnboardingIntroSlide extends StatefulWidget {
  const OnboardingIntroSlide({super.key, required this.onFinished});

  final VoidCallback onFinished;

  @override
  State<OnboardingIntroSlide> createState() => _OnboardingIntroSlideState();
}

class _OnboardingIntroSlideState extends State<OnboardingIntroSlide>
    with SingleTickerProviderStateMixin {
  late final AnimationController _intro;
  late final List<double> _sparkSeeds;
  var _finished = false;

  @override
  void initState() {
    super.initState();
    _sparkSeeds = AuthBurstLayout.sparkSeeds();
    _intro = AnimationController(vsync: this, duration: AuthMotion.duration)
      ..addStatusListener(_onStatus);
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  void _start() {
    if (!mounted) return;
    if (reduceMotionOf(context)) {
      widget.onFinished();
      return;
    }
    _intro.forward();
  }

  void _onStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed || _finished) return;
    _finished = true;
    widget.onFinished();
  }

  @override
  void dispose() {
    _intro.removeStatusListener(_onStatus);
    _intro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final flame = size.shortestSide * 0.38;
    final center = Offset(size.width * 0.5, size.height * 0.5);

    return AnimatedBuilder(
      animation: _intro,
      builder: (context, _) {
        return FlameIntroView(
          introT: _intro.value,
          flame: flame,
          center: center,
          size: size,
          sparkSeeds: _sparkSeeds,
        );
      },
    );
  }
}
