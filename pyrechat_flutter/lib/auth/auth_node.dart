/// Stable nodes in the auth flow. Animation only moves between these — never inferred
/// from controller values.
enum AuthNode {
  launch,
  idle,
  authChoice,
  loginSelected,
  signupSelected,
  loginForm,
  signupForm,
}

extension AuthNodeNavigation on AuthNode {
  AuthNode? get back {
    switch (this) {
      case AuthNode.loginForm:
        return AuthNode.loginSelected;
      case AuthNode.loginSelected:
      case AuthNode.signupSelected:
        return AuthNode.authChoice;
      case AuthNode.signupForm:
        return AuthNode.signupSelected;
      case AuthNode.authChoice:
        return AuthNode.idle;
      case AuthNode.launch:
      case AuthNode.idle:
        return null;
    }
  }

  bool get isForm => this == AuthNode.loginForm || this == AuthNode.signupForm;

  /// Exactly one flame layout is shown per node — never overlap layers.
  bool get showsCenterFlame => this == AuthNode.idle;

  bool get showsSplitChoice => this == AuthNode.authChoice;

  bool get showsSelection =>
      this == AuthNode.loginSelected || this == AuthNode.signupSelected;
}
