import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

enum _Phase { launch, idle, animating, split }

class SplashAuthScreen extends StatefulWidget {
  const SplashAuthScreen({super.key});

  @override
  State<SplashAuthScreen> createState() => _SplashAuthScreenState();
}

class _SplashAuthScreenState extends State<SplashAuthScreen>
    with TickerProviderStateMixin {
  static const _burstCount = 10;
  static const _sparkCount = 14;

  late final AnimationController _introController;
  late final AnimationController _burstController;
  late final List<double> _burstAngles;
  late final List<double> _sparkSeeds;

  _Phase _phase = _Phase.launch;
  double _swipeDx = 0;

  @override
  void initState() {
    super.initState();
    final rng = math.Random(42);
    _burstAngles = List.generate(
      _burstCount,
      (i) => (i / _burstCount) * math.pi * 2 + rng.nextDouble() * 0.35,
    );
    _sparkSeeds = List.generate(_sparkCount, (i) => rng.nextDouble());

    _introController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..addStatusListener((status) {
        if (!mounted) return;
        if (status == AnimationStatus.completed && _phase == _Phase.launch) {
          setState(() => _phase = _Phase.idle);
        }
      });

    _burstController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..addStatusListener((status) {
        if (!mounted) return;
        if (status == AnimationStatus.completed) {
          setState(() => _phase = _Phase.split);
        } else if (status == AnimationStatus.dismissed) {
          setState(() => _phase = _Phase.idle);
        }
      });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _phase == _Phase.launch) {
        _introController.forward();
      }
    });
  }

  @override
  void dispose() {
    _introController.dispose();
    _burstController.dispose();
    super.dispose();
  }

  void _skipLaunch() {
    if (_phase != _Phase.launch) return;
    _introController.stop();
    setState(() => _phase = _Phase.idle);
  }

  void _ignite() {
    if (_phase != _Phase.idle) return;
    setState(() => _phase = _Phase.animating);
    _burstController.forward(from: 0);
  }

  void _goBackToMainFlame() {
    if (_phase == _Phase.split) {
      setState(() => _phase = _Phase.animating);
      _burstController.reverse();
      return;
    }
    if (_phase == _Phase.animating &&
        _burstController.status == AnimationStatus.forward) {
      _burstController.reverse();
    }
  }

  Future<void> _handleSystemBack() async {
    if (_phase == _Phase.launch) {
      _skipLaunch();
      return;
    }
    if (_phase == _Phase.split || _phase == _Phase.animating) {
      _goBackToMainFlame();
      return;
    }

    final leave = await showDialog<bool>(
      context: context,
      barrierColor: PyreColors.ink.withValues(alpha: 0.72),
      builder: (context) => AlertDialog(
        backgroundColor: PyreColors.panel,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text(
          'Leave PyreChat?',
          style: TextStyle(color: PyreColors.paper, fontWeight: FontWeight.w800),
        ),
        content: const Text(
          'Are you sure you want to exit the app?',
          style: TextStyle(color: PyreColors.mute),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text(
              'Stay',
              style: TextStyle(
                color: PyreColors.paper,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Leave',
              style: TextStyle(
                color: PyreColors.ember,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );

    if (leave == true && mounted) {
      SystemNavigator.pop();
    }
  }

  void _onSignIn() {}

  void _onSignUp() {}

  double _interval(double t, double start, double end) {
    if (t <= start) return 0;
    if (t >= end) return 1;
    return (t - start) / (end - start);
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final flame = size.shortestSide * 0.38;
    final splitFlame = size.shortestSide * 0.28;
    final center = Offset(size.width * 0.5, size.height * 0.5);
    final left = Offset(size.width * 0.28, size.height * 0.5);
    final right = Offset(size.width * 0.72, size.height * 0.5);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleSystemBack();
      },
      child: Scaffold(
        backgroundColor: PyreColors.ember,
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onHorizontalDragStart: (_) => _swipeDx = 0,
          onHorizontalDragUpdate: (details) {
            if (_phase == _Phase.split && details.delta.dx > 0) {
              _swipeDx += details.delta.dx;
            }
          },
          onHorizontalDragEnd: (details) {
            if (_phase != _Phase.split) return;
            final velocity = details.primaryVelocity ?? 0;
            if (_swipeDx > 72 || velocity > 350) {
              _goBackToMainFlame();
            }
            _swipeDx = 0;
          },
          child: AnimatedBuilder(
            animation: Listenable.merge([_introController, _burstController]),
            builder: (context, _) {
              if (_phase == _Phase.launch) {
                return _buildLaunchSplash(size, flame, center);
              }
              return _buildMainFlow(
                flame: flame,
                splitFlame: splitFlame,
                center: center,
                left: left,
                right: right,
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildLaunchSplash(Size size, double flame, Offset center) {
    final t = _introController.value;
    final glow = Curves.easeOut.transform(_interval(t, 0.08, 0.85));
    final flameIn = Curves.easeOutCubic.transform(_interval(t, 0, 0.55));
    final settle = Curves.elasticOut.transform(_interval(t, 0.45, 1));
    final flameScale = (0.88 + flameIn * 0.12) * (0.97 + settle * 0.03);
    final flameOpacity = Curves.easeIn.transform(_interval(t, 0, 0.2)).clamp(0.92, 1.0);

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
          for (var i = 0; i < _sparkCount; i++) _launchSpark(size, t, i),
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

  Widget _launchSpark(Size size, double t, int index) {
    final seed = _sparkSeeds[index];
    final start = 0.18 + seed * 0.35;
    final life = Curves.easeOut.transform(_interval(t, start, 0.95));
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

  Widget _buildMainFlow({
    required double flame,
    required double splitFlame,
    required Offset center,
    required Offset left,
    required Offset right,
  }) {
    final t = _burstController.value;
    final burst = Curves.easeOut.transform(_interval(t, 0.02, 0.32));
    final disintegrate = Curves.easeIn.transform(_interval(t, 0.28, 0.62));
    final split = Curves.easeOutCubic.transform(_interval(t, 0.52, 1));

    final mainScale = _phase == _Phase.idle
        ? 1.0
        : 1.0 + burst * 0.42 - disintegrate * 0.18;
    final mainOpacity = _phase == _Phase.idle
        ? 1.0
        : (1 - disintegrate).clamp(0.0, 1.0);

    return Stack(
      fit: StackFit.expand,
      children: [
        if (_phase != _Phase.split) ...[
          for (var i = 0; i < _burstCount; i++)
            _burstEmber(
              angle: _burstAngles[i],
              progress: burst,
              fade: disintegrate,
              origin: center,
              size: flame * (0.18 + (i % 3) * 0.06),
            ),
          Positioned(
            left: center.dx - flame / 2,
            top: center.dy - flame / 2,
            child: GestureDetector(
              onTap: _ignite,
              child: Transform.scale(
                scale: mainScale,
                child: PyreLogo(size: flame, opacity: mainOpacity),
              ),
            ),
          ),
        ],
        if (_phase == _Phase.split || split > 0) ...[
          _splitFlame(
            position: Offset.lerp(center, left, split)!,
            size: splitFlame,
            opacity: split,
            onTap: _onSignIn,
          ),
          _splitFlame(
            position: Offset.lerp(center, right, split)!,
            size: splitFlame,
            opacity: split,
            onTap: _onSignUp,
          ),
        ],
      ],
    );
  }

  Widget _burstEmber({
    required double angle,
    required double progress,
    required double fade,
    required Offset origin,
    required double size,
  }) {
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

  Widget _splitFlame({
    required Offset position,
    required double size,
    required double opacity,
    required VoidCallback onTap,
  }) {
    return Positioned(
      left: position.dx - size / 2,
      top: position.dy - size / 2,
      child: GestureDetector(
        onTap: opacity >= 0.95 ? onTap : null,
        child: Opacity(
          opacity: opacity,
          child: PyreLogo(size: size),
        ),
      ),
    );
  }
}
