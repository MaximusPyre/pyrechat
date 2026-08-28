import 'package:pyrechat_flutter/auth/signup_step.dart';

class AuthFormState {
  String username = '';
  String password = '';
  String? loginError;
  bool loginBusy = false;

  SignupStep signupStep = SignupStep.displayName;
  String displayName = '';
  String signupUsername = '';
  String birthday = '';
  String signupPassword = '';
  String? signupError;
  bool signupBusy = false;

  void resetSignup() {
    signupStep = SignupStep.displayName;
    signupError = null;
    signupBusy = false;
  }
}
