import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_motion.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

/// Flame-only zoom layer — background color lives in [AuthSceneView].
class AuthZoomLoginView extends StatelessWidget {
  const AuthZoomLoginView({
    super.key,
    required this.zoomT,
    required this.flame,
  });

  final double zoomT;
  final double flame;

  @override
  Widget build(BuildContext context) {
    final zoom = AuthMotion.zoomCurve.transform(zoomT);
    final flameScale = 1 + zoom * 14;
    final flameFade = AuthMotion.phase(zoomT, 0.08, 0.52, AuthMotion.exit);

    return IgnorePointer(
      child: Center(
        child: Transform.scale(
          scale: flameScale,
          child: Opacity(
            opacity: (1 - flameFade).clamp(0.0, 1.0),
            child: PyreLogo(size: flame),
          ),
        ),
      ),
    );
  }
}

class AuthZoomSignupView extends StatelessWidget {
  const AuthZoomSignupView({
    super.key,
    required this.zoomT,
    required this.flame,
  });

  final double zoomT;
  final double flame;

  @override
  Widget build(BuildContext context) {
    final zoom = AuthMotion.zoomCurve.transform(zoomT);
    final flameScale = 1 + zoom * 12;
    final flameFade = AuthMotion.phase(zoomT, 0.08, 0.52, AuthMotion.exit);

    return IgnorePointer(
      child: Center(
        child: Transform.scale(
          scale: flameScale,
          child: Opacity(
            opacity: (1 - flameFade).clamp(0.0, 1.0),
            child: PyreLogo(size: flame),
          ),
        ),
      ),
    );
  }
}
