import 'package:flutter/material.dart';

class PyreLogo extends StatelessWidget {
  const PyreLogo({super.key, required this.size, this.opacity = 1});

  final double size;
  final double opacity;

  static const _asset = 'assets/pyre_flame.png';

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
