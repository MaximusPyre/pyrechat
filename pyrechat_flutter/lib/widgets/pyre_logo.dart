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

  static const _signInAsset = 'assets/pyre_flame_signin.png';
  static const _signUpAsset = 'assets/pyre_flame_signup.png';

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
