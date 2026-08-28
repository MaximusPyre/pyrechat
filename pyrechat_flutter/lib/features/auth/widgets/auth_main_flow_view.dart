import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_motion.dart';
import 'package:pyrechat_flutter/auth/auth_choice.dart';
import 'package:pyrechat_flutter/auth/auth_flow_controller.dart';
import 'package:pyrechat_flutter/auth/auth_node.dart';
import 'package:pyrechat_flutter/auth/auth_burst_layout.dart';
import 'package:pyrechat_flutter/features/auth/widgets/burst_ember.dart';
import 'package:pyrechat_flutter/features/auth/widgets/idle_flame_view.dart';
import 'package:pyrechat_flutter/widgets/flame_auth_button.dart';
import 'package:pyrechat_flutter/widgets/pyre_logo.dart';

/// Renders exactly one flame layout based on [AuthFlowController.node].
class AuthMainFlowView extends StatelessWidget {
  const AuthMainFlowView({
    super.key,
    required this.flow,
    required this.burstAngles,
    required this.flame,
    required this.splitFlame,
    required this.center,
    required this.left,
    required this.right,
  });

  final AuthFlowController flow;
  final List<double> burstAngles;
  final double flame;
  final double splitFlame;
  final Offset center;
  final Offset left;
  final Offset right;

  @override
  Widget build(BuildContext context) {
    final node = flow.node;
    final burstT = flow.burst.value;

    // Idle: single flame. Ignite: dissolve into split (no ember burst).
    if (node.showsCenterFlame || node.showsSplitChoice) {
      if (burstT <= 0.001 && node.showsCenterFlame) {
        return IdleFlameView(
          flame: flame,
          center: center,
          onIgnite: flow.isBusy ? null : flow.ignite,
        );
      }
      return _DissolveToSplit(
        t: burstT,
        flame: flame,
        splitFlame: splitFlame,
        center: center,
        left: left,
        right: right,
        onLogin: flow.pickLogin,
        onSignup: flow.pickSignup,
      );
    }

    if (node.showsSelection) {
      return _SelectionFlames(
        burstAngles: burstAngles,
        choice: flow.choice!,
        selectT: flow.select.value,
        flame: flame,
        splitFlame: splitFlame,
        left: left,
        right: right,
        center: center,
        onLogin: flow.retryLoginZoom,
        onSignup: flow.pickSignup,
      );
    }

    return const SizedBox.shrink();
  }
}

/// One center flame dissolves into Log in / Sign up — no particle burst.
class _DissolveToSplit extends StatelessWidget {
  const _DissolveToSplit({
    required this.t,
    required this.flame,
    required this.splitFlame,
    required this.center,
    required this.left,
    required this.right,
    required this.onLogin,
    required this.onSignup,
  });

  final double t;
  final double flame;
  final double splitFlame;
  final Offset center;
  final Offset left;
  final Offset right;
  final VoidCallback? onLogin;
  final VoidCallback? onSignup;

  @override
  Widget build(BuildContext context) {
    final split = AuthMotion.phase(t, 0.0, 1.0, AuthMotion.flow);
    final centerFade =
        (1 - AuthMotion.phase(t, 0.08, 0.55, AuthMotion.exit)).clamp(0.0, 1.0);
    final labelsIn = AuthMotion.phase(t, 0.35, 0.75, AuthMotion.enter);
    final buttonSize = splitFlame + (flame - splitFlame) * (1 - split);
    final buttonOpacity =
        t >= 0.99 ? 1.0 : AuthMotion.phase(t, 0.12, 0.5, AuthMotion.enter);

    return Stack(
      fit: StackFit.expand,
      children: [
        if (centerFade > 0.01)
          Positioned(
            left: center.dx - flame / 2,
            top: center.dy - flame / 2,
            child: IgnorePointer(
              child: Opacity(
                opacity: centerFade,
                child: Transform.scale(
                  scale: 1 - split * 0.12,
                  child: PyreLogo(size: flame),
                ),
              ),
            ),
          ),
        FlameAuthButton(
          label: 'Log in',
          position: Offset.lerp(center, left, split)!,
          size: buttonSize,
          opacity: buttonOpacity,
          showLabel: labelsIn > 0.5,
          labelOpacity: labelsIn,
          onTap: onLogin,
        ),
        FlameAuthButton(
          label: 'Sign up',
          position: Offset.lerp(center, right, split)!,
          size: buttonSize,
          opacity: buttonOpacity,
          showLabel: labelsIn > 0.5,
          labelOpacity: labelsIn,
          onTap: onSignup,
        ),
      ],
    );
  }
}

class _SelectionFlames extends StatelessWidget {
  const _SelectionFlames({
    required this.burstAngles,
    required this.choice,
    required this.selectT,
    required this.flame,
    required this.splitFlame,
    required this.left,
    required this.right,
    required this.center,
    required this.onLogin,
    required this.onSignup,
  });

  final List<double> burstAngles;
  final AuthChoice choice;
  final double selectT;
  final double flame;
  final double splitFlame;
  final Offset left;
  final Offset right;
  final Offset center;
  final VoidCallback? onLogin;
  final VoidCallback? onSignup;

  @override
  Widget build(BuildContext context) {
    final pickBurst = AuthMotion.phase(selectT, 0.0, 0.36, AuthMotion.enter);
    final pickFade = AuthMotion.phase(selectT, 0.2, 0.55, AuthMotion.exit);
    final pickGrow = AuthMotion.phase(selectT, 0.38, 1.0, AuthMotion.flow);

    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < AuthBurstLayout.burstCount; i++) ...[
          BurstEmber(
            angle: burstAngles[i],
            progress: pickBurst,
            fade: pickFade,
            origin: choice == AuthChoice.login ? left : right,
            size: splitFlame * (0.18 + (i % 3) * 0.06),
          ),
          BurstEmber(
            angle: burstAngles[(i + 5) % AuthBurstLayout.burstCount],
            progress: pickBurst,
            fade: pickFade,
            origin: choice == AuthChoice.login ? right : left,
            size: splitFlame * (0.14 + (i % 3) * 0.05),
          ),
        ],
        FlameAuthButton(
          label: 'Log in',
          position: Offset.lerp(
            left,
            center,
            choice == AuthChoice.login ? pickGrow : 0,
          )!,
          size: splitFlame,
          scale: choice == AuthChoice.login
              ? (1 + pickBurst * 0.42 * (1 - pickGrow)) +
                  pickGrow * (flame / splitFlame - 1)
              : 1 + pickBurst * 0.42 - pickFade * 0.18,
          opacity: choice == AuthChoice.login
              ? 1
              : (1 - pickFade).clamp(0.0, 1.0),
          onTap: onLogin,
        ),
        FlameAuthButton(
          label: 'Sign up',
          position: Offset.lerp(
            right,
            center,
            choice == AuthChoice.signup ? pickGrow : 0,
          )!,
          size: splitFlame,
          scale: choice == AuthChoice.signup
              ? (1 + pickBurst * 0.42 * (1 - pickGrow)) +
                  pickGrow * (flame / splitFlame - 1)
              : 1 + pickBurst * 0.42 - pickFade * 0.18,
          opacity: choice == AuthChoice.signup
              ? 1
              : (1 - pickFade).clamp(0.0, 1.0),
          onTap: onSignup,
        ),
      ],
    );
  }
}
