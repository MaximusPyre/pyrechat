import 'package:flutter/material.dart';

/// Detects horizontal swipes without competing with child tap gestures.
class AuthSwipeScope extends StatefulWidget {
  const AuthSwipeScope({
    super.key,
    required this.child,
    required this.onSwipeBack,
    required this.onSwipeForward,
  });

  final Widget child;
  final VoidCallback onSwipeBack;
  final VoidCallback onSwipeForward;

  @override
  State<AuthSwipeScope> createState() => _AuthSwipeScopeState();
}

class _AuthSwipeScopeState extends State<AuthSwipeScope> {
  static const _threshold = 72.0;

  Offset? _down;

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (event) => _down = event.position,
      onPointerUp: (event) => _handleUp(event.position),
      onPointerCancel: (_) => _down = null,
      child: widget.child,
    );
  }

  void _handleUp(Offset position) {
    if (_down == null) return;
    final delta = position - _down!;
    _down = null;

    if (delta.dx.abs() < _threshold) return;
    if (delta.dx.abs() <= delta.dy.abs()) return;

    if (delta.dx > 0) {
      widget.onSwipeBack();
    } else {
      widget.onSwipeForward();
    }
  }
}
