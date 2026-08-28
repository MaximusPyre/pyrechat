import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:pyrechat_flutter/effects/ember_particles.dart';
import 'package:pyrechat_flutter/effects/flame_burst.dart';
import 'package:pyrechat_flutter/effects/pyre_sound.dart';
import 'package:pyrechat_flutter/navigation/pyre_page.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> with TickerProviderStateMixin {
  late final AnimationController _pulse;
  late final AnimationController _ignite;
  var _busy = false;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    )..repeat(reverse: true);
    _ignite = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: FlameBurst.totalMs),
    );
  }

  @override
  void dispose() {
    _pulse.dispose();
    _ignite.dispose();
    super.dispose();
  }

  Future<void> _onTap() async {
    if (_busy) return;
    _busy = true;
    HapticFeedback.selectionClick();

    Future<void>.delayed(const Duration(milliseconds: 70), PyreSound.playIgnite);

    await _ignite.forward(from: 0);
    if (!mounted) return;
    await Navigator.of(context).pushReplacementNamed(PyreRoutes.authChoice);
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final flame = size.shortestSide * 0.38;
    final center = Offset(size.width * 0.5, size.height * 0.5);

    return Scaffold(
      backgroundColor: PyreColors.ember,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _busy ? null : _onTap,
        child: AnimatedBuilder(
          animation: Listenable.merge([_pulse, _ignite]),
          builder: (context, _) {
            if (_ignite.value > 0) {
              return Stack(
                fit: StackFit.expand,
                children: [
                  FlameBurstView(
                    t: _ignite.value,
                    flameSize: flame,
                    center: center,
                  ),
                  EmberParticles(
                    progress: FlameBurst.emberDrift(_ignite.value),
                    origin: center,
                    spread: flame,
                  ),
                ],
              );
            }

            final t = Curves.easeInOut.transform(_pulse.value);
            final glow = 0.14 + t * 0.22;
            return Stack(
              fit: StackFit.expand,
              children: [
                Positioned(
                  left: center.dx - flame * 0.7,
                  top: center.dy - flame * 0.7,
                  child: Container(
                    width: flame * 1.4,
                    height: flame * 1.4,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          PyreColors.paper.withValues(alpha: glow),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: center.dx - flame / 2,
                  top: center.dy - flame / 2,
                  child: Transform.scale(
                    scale: 1 + t * 0.05,
                    child: PyreLogo(size: flame),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
