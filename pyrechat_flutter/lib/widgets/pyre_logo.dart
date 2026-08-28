import 'package:flutter/material.dart';

enum PyreFlameKind {
  signIn,
  signUp,
}

class PyreLogo extends StatelessWidget {
  const PyreLogo({
    super.key,
    required this.size,
    this.opacity = 1,
    this.kind = PyreFlameKind.signIn,
  });

  final double size;
  final double opacity;
  final PyreFlameKind kind;

  static const _signInAsset =
      'assets/ChatGPT Image Aug 28, 2026, 07_34_39 PM (1).png';
  static const _signUpAsset =
      'assets/ChatGPT Image Aug 28, 2026, 07_34_39 PM (2).png';

  String get _asset => switch (kind) {
        PyreFlameKind.signIn => _signInAsset,
        PyreFlameKind.signUp => _signUpAsset,
      };

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: opacity,
      child: SizedBox(
        width: size,
        height: size,
        child: Image.asset(
          _asset,
          width: size,
          height: size,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
          isAntiAlias: true,
        ),
      ),
    );
  }
}
