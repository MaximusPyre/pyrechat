import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pyrechat_flutter/widgets/flame_sheen.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

class IdleFlameView extends StatefulWidget {
  const IdleFlameView({
    super.key,
    required this.flame,
    required this.center,
    required this.onIgnite,
  });

  final double flame;
  final Offset center;
  final VoidCallback? onIgnite;

  @override
  State<IdleFlameView> createState() => _IdleFlameViewState();
}

class _TrailEmber {
  _TrailEmber({
    required this.position,
    required this.createdAt,
    required this.rotation,
    required this.size,
  });

  final Offset position;
  final DateTime createdAt;
  final double rotation;
  final double size;
}

class _IdleFlameViewState extends State<IdleFlameView>
    with TickerProviderStateMixin {
  static const _emberLifetime = Duration(milliseconds: 720);
  static const _spawnSpacing = 14.0;
  static const _sheenFlashDuration = Duration(milliseconds: 340);
  static const _sheenPause = Duration(milliseconds: 2600);

  late final AnimationController _pulse;
  late final AnimationController _sheenFlash;
  late final AnimationController _emberTick;

  final _embers = <_TrailEmber>[];
  final _stackKey = GlobalKey();
  Timer? _sheenTimer;

  bool _pressed = false;
  bool _armed = false;
  Offset? _lastSpawn;
  int _pointerId = -1;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
    _sheenFlash = AnimationController(
      vsync: this,
      duration: _sheenFlashDuration,
    )..addStatusListener(_onSheenFlashStatus);
    _emberTick = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat();
    _emberTick.addListener(_onEmberTick);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _scheduleSheenFlash(delay: const Duration(milliseconds: 900)),
    );
  }

  void _onSheenFlashStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    _sheenFlash.value = 0;
    if (!_pressed) _scheduleSheenFlash();
  }

  void _scheduleSheenFlash({Duration? delay}) {
    _sheenTimer?.cancel();
    final rng = math.Random();
    final pause = delay ??
        _sheenPause + Duration(milliseconds: rng.nextInt(700));
    _sheenTimer = Timer(pause, () {
      if (!mounted || _pressed) return;
      _sheenFlash.forward(from: 0);
    });
  }

  @override
  void dispose() {
    _sheenTimer?.cancel();
    _pulse.dispose();
    _sheenFlash.removeStatusListener(_onSheenFlashStatus);
    _sheenFlash.dispose();
    _emberTick.removeListener(_onEmberTick);
    _emberTick.dispose();
    super.dispose();
  }

  void _onEmberTick() {
    final cutoff = DateTime.now().subtract(_emberLifetime);
    final before = _embers.length;
    _embers.removeWhere((e) => e.createdAt.isBefore(cutoff));
    if (_embers.length != before || _pressed) {
      setState(() {});
    }
  }

  Offset? _toLocal(Offset global) {
    final box = _stackKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return null;
    return box.globalToLocal(global);
  }

  bool _onFlame(Offset local) {
    return (local - widget.center).distance <= widget.flame * 0.56;
  }

  void _spawnEmber(Offset local) {
    if (_lastSpawn != null && (local - _lastSpawn!).distance < _spawnSpacing) {
      return;
    }
    _lastSpawn = local;
    final rng = math.Random();
    _embers.add(
      _TrailEmber(
        position: local,
        createdAt: DateTime.now(),
        rotation: rng.nextDouble() * math.pi * 2,
        size: widget.flame * (0.08 + rng.nextDouble() * 0.06),
      ),
    );
  }

  void _onPointerDown(PointerDownEvent event) {
    if (widget.onIgnite == null) return;
    final local = _toLocal(event.position);
    if (local == null || !_onFlame(local)) return;

    _pointerId = event.pointer;
    _pressed = true;
    _armed = true;
    _sheenTimer?.cancel();
    _sheenFlash.stop();
    _sheenFlash.value = 0;
    _lastSpawn = null;
    _spawnEmber(local);
    setState(() {});
  }

  void _onPointerMove(PointerMoveEvent event) {
    if (!_pressed || event.pointer != _pointerId) return;
    final local = _toLocal(event.position);
    if (local == null) return;

    if (!_onFlame(local)) _armed = false;
    _spawnEmber(local);
    setState(() {});
  }

  void _onPointerUp(PointerUpEvent event) {
    if (event.pointer != _pointerId) return;
    _finish(event.position);
  }

  void _onPointerCancel(PointerCancelEvent event) {
    if (event.pointer != _pointerId) return;
    _finish(null);
  }

  void _finish(Offset? global) {
    var ignite = false;
    if (_armed && widget.onIgnite != null && global != null) {
      final local = _toLocal(global);
      ignite = local != null && _onFlame(local);
    }

    _pressed = false;
    _armed = false;
    _pointerId = -1;
    _lastSpawn = null;
    setState(() {});

    if (!ignite) _scheduleSheenFlash();
    if (ignite) {
      HapticFeedback.mediumImpact();
      widget.onIgnite!();
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    return Listener(
      key: _stackKey,
      behavior: HitTestBehavior.translucent,
      onPointerDown: _onPointerDown,
      onPointerMove: _onPointerMove,
      onPointerUp: _onPointerUp,
      onPointerCancel: _onPointerCancel,
      child: Stack(
        fit: StackFit.expand,
        clipBehavior: Clip.none,
        children: [
          for (final ember in _embers)
            _EmberSpeck(
              ember: ember,
              now: now,
              lifetime: _emberLifetime,
            ),
          Positioned(
            left: widget.center.dx - widget.flame / 2,
            top: widget.center.dy - widget.flame / 2,
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: Listenable.merge([_pulse, _sheenFlash]),
                builder: (context, child) {
                  final pulse =
                      1.0 + Curves.easeInOut.transform(_pulse.value) * 0.05;
                  final press = _pressed ? 1.14 : 1.0;
                  final flashing = _sheenFlash.isAnimating;
                  final sheenT =
                      Curves.easeIn.transform(_sheenFlash.value.clamp(0.0, 1.0));
                  return Transform.scale(
                    scale: pulse * press,
                    child: FlameSheen(
                      size: widget.flame,
                      sheenT: sheenT,
                      intensity: flashing ? 0.52 : 0,
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmberSpeck extends StatelessWidget {
  const _EmberSpeck({
    required this.ember,
    required this.now,
    required this.lifetime,
  });

  final _TrailEmber ember;
  final DateTime now;
  final Duration lifetime;

  @override
  Widget build(BuildContext context) {
    final age = now.difference(ember.createdAt);
    final t = (age.inMilliseconds / lifetime.inMilliseconds).clamp(0.0, 1.0);
    if (t >= 1) return const SizedBox.shrink();

    final fade = (1 - Curves.easeIn.transform(t)).clamp(0.0, 1.0);
    final drift = t * 18;

    return Positioned(
      left: ember.position.dx - ember.size / 2,
      top: ember.position.dy - ember.size / 2 - drift,
      child: IgnorePointer(
        child: Transform.rotate(
          angle: ember.rotation,
          child: Opacity(
            opacity: fade,
            child: Transform.scale(
              scale: 1 - t * 0.35,
              child: PyreLogo(size: ember.size),
            ),
          ),
        ),
      ),
    );
  }
}
