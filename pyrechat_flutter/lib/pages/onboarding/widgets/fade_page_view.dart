import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_motion.dart';
import 'package:pyrechat_flutter/utils/motion_prefs.dart';

/// Cross-fades between child pages instead of sliding.
class FadePageView extends StatefulWidget {
  const FadePageView({
    super.key,
    required this.index,
    required this.children,
    this.duration = const Duration(milliseconds: 900),
    this.curve = Curves.easeInOutCubic,
  });

  final int index;
  final List<Widget> children;
  final Duration duration;
  final Curve curve;

  @override
  State<FadePageView> createState() => _FadePageViewState();
}

class _FadePageViewState extends State<FadePageView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fade;
  late Animation<double> _dissolve;

  int _current = 0;
  int? _outgoing;

  @override
  void initState() {
    super.initState();
    _current = widget.index;
    _fade = AnimationController(vsync: this, duration: widget.duration);
    _dissolve = CurvedAnimation(parent: _fade, curve: widget.curve);
  }

  @override
  void didUpdateWidget(covariant FadePageView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.duration != widget.duration) {
      _fade.duration = widget.duration;
    }
    if (oldWidget.curve != widget.curve) {
      _dissolve = CurvedAnimation(parent: _fade, curve: widget.curve);
    }
    if (oldWidget.index != widget.index) {
      _animateTo(widget.index);
    }
  }

  Future<void> _animateTo(int index) async {
    if (index == _current || index < 0 || index >= widget.children.length) {
      return;
    }
    if (reduceMotionOf(context)) {
      setState(() {
        _outgoing = null;
        _current = index;
      });
      return;
    }

    setState(() => _outgoing = _current);
    _fade.value = 0;
    setState(() => _current = index);

    await _fade.forward();
    if (!mounted) return;
    setState(() => _outgoing = null);
    _fade.value = 0;
  }

  double _opacityFor(int index) {
    if (_outgoing == null) return index == _current ? 1 : 0;
    if (index == _current) return _dissolve.value;
    if (index == _outgoing) return 1 - _dissolve.value;
    return 0;
  }

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _fade,
      builder: (context, _) {
        return Stack(
          fit: StackFit.expand,
          children: [
            for (var i = 0; i < widget.children.length; i++)
              Positioned.fill(
                child: IgnorePointer(
                  ignoring: i != _current,
                  child: Opacity(
                    opacity: _opacityFor(i).clamp(0.0, 1.0),
                    child: widget.children[i],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Dissolve timing for splash → auth choice.
const onboardingDissolveDuration = Duration(milliseconds: 1200);
const onboardingDissolveCurve = AuthMotion.flow;
