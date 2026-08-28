import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/auth/auth_motion.dart';
import 'package:pyrechat_flutter/auth/auth_flow_controller.dart';
import 'package:pyrechat_flutter/auth/auth_node.dart';
import 'package:pyrechat_flutter/features/auth/widgets/auth_main_flow_view.dart';
import 'package:pyrechat_flutter/features/auth/widgets/auth_zoom_views.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';
import 'package:pyrechat_flutter/widgets/login_panel.dart';
import 'package:pyrechat_flutter/widgets/signup_flow_panel.dart';

class AuthSceneView extends StatelessWidget {
  const AuthSceneView({
    super.key,
    required this.flow,
    required this.burstAngles,
    required this.flame,
    required this.splitFlame,
    required this.center,
    required this.left,
    required this.right,
    required this.onLoginSubmit,
    required this.onSignupNext,
  });

  final AuthFlowController flow;
  final List<double> burstAngles;
  final double flame;
  final double splitFlame;
  final Offset center;
  final Offset left;
  final Offset right;
  final VoidCallback onLoginSubmit;
  final VoidCallback onSignupNext;

  @override
  Widget build(BuildContext context) {
    final zoomT = flow.zoom.value;
    final loginZoom = flow.loginZoomVisible;
    final signupZoom = flow.signupZoomVisible;

    // Hide split/selection flames once zoom takes over.
    final zoomingIn = zoomT > 0.04;
    final showMain = !flow.node.isForm && !(flow.node.showsSelection && zoomingIn);

    // Forms are driven only by zoom — never by node.
    final loginFormOpacity =
        AuthMotion.phase(zoomT, 0.86, 0.98, AuthMotion.enter);
    final signupFormOpacity =
        AuthMotion.phase(zoomT, 0.82, 0.96, AuthMotion.enter);

    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: _background(zoomT, loginZoom)),
        if (showMain)
          AuthMainFlowView(
            flow: flow,
            burstAngles: burstAngles,
            flame: flame,
            splitFlame: splitFlame,
            center: center,
            left: left,
            right: right,
          ),
        if (loginZoom) AuthZoomLoginView(zoomT: zoomT, flame: flame),
        if (signupZoom) AuthZoomSignupView(zoomT: zoomT, flame: flame),
        if (loginZoom && flow.formVisible && loginFormOpacity > 0)
          IgnorePointer(
            ignoring: !flow.formInteractive,
            child: Opacity(
              opacity: loginFormOpacity.clamp(0.0, 1.0),
              child: _loginForm(),
            ),
          ),
        if (signupZoom && flow.formVisible && signupFormOpacity > 0)
          IgnorePointer(
            ignoring: !flow.formInteractive,
            child: Opacity(
              opacity: signupFormOpacity.clamp(0.0, 1.0),
              child: _signupForm(),
            ),
          ),
      ],
    );
  }

  Color _background(double zoomT, bool loginZoom) {
    if (!loginZoom) return PyreColors.ember;
    final toWhite = AuthMotion.phase(zoomT, 0.28, 1.0, AuthMotion.flow);
    return Color.lerp(PyreColors.ember, Colors.white, toWhite)!;
  }

  Widget _loginForm() {
    final f = flow.forms;
    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: LoginPanel(
            username: f.username,
            password: f.password,
            onUsernameChanged: (v) {
              f.username = v;
              flow.touchForms();
            },
            onPasswordChanged: (v) {
              f.password = v;
              flow.touchForms();
            },
            onSubmit: onLoginSubmit,
            busy: f.loginBusy,
            error: f.loginError,
          ),
        ),
      ),
    );
  }

  Widget _signupForm() {
    final f = flow.forms;
    return SignupFlowPanel(
      step: f.signupStep,
      displayName: f.displayName,
      username: f.signupUsername,
      birthday: f.birthday,
      password: f.signupPassword,
      onDisplayNameChanged: (v) {
        f.displayName = v;
        flow.touchForms();
      },
      onUsernameChanged: (v) {
        f.signupUsername = v;
        flow.touchForms();
      },
      onBirthdayChanged: (v) {
        f.birthday = v;
        flow.touchForms();
      },
      onPasswordChanged: (v) {
        f.signupPassword = v;
        flow.touchForms();
      },
      onNext: onSignupNext,
      busy: f.signupBusy,
      error: f.signupError,
    );
  }
}
