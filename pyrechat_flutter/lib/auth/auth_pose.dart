import 'package:pyrechat_flutter/auth/auth_choice.dart';
import 'package:pyrechat_flutter/auth/auth_node.dart';

/// Canonical animation-channel values for each stable [AuthNode].
class AuthPose {
  const AuthPose({
    this.burst = 0,
    this.select = 0,
    this.zoom = 0,
    this.choice,
  });

  final double burst;
  final double select;
  final double zoom;
  final AuthChoice? choice;

  static AuthPose of(AuthNode node) {
    switch (node) {
      case AuthNode.launch:
      case AuthNode.idle:
        return const AuthPose();
      case AuthNode.authChoice:
        return const AuthPose(burst: 1);
      case AuthNode.loginSelected:
        return const AuthPose(
          burst: 1,
          select: 1,
          choice: AuthChoice.login,
        );
      case AuthNode.signupSelected:
        return const AuthPose(
          burst: 1,
          select: 1,
          choice: AuthChoice.signup,
        );
      case AuthNode.loginForm:
        return const AuthPose(
          burst: 1,
          select: 1,
          zoom: 1,
          choice: AuthChoice.login,
        );
      case AuthNode.signupForm:
        return const AuthPose(
          burst: 1,
          select: 1,
          zoom: 1,
          choice: AuthChoice.signup,
        );
    }
  }
}
