import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pyrechat_flutter/auth/auth_choice.dart';
import 'package:pyrechat_flutter/auth/auth_form_state.dart';
import 'package:pyrechat_flutter/auth/auth_motion.dart';
import 'package:pyrechat_flutter/auth/auth_node.dart';
import 'package:pyrechat_flutter/auth/auth_pose.dart';
import 'package:pyrechat_flutter/auth/signup_step.dart';

/// Owns auth navigation state, animation channels, and gesture history.
///
/// Rule: [node] is the only source of truth for where we are. Controllers are
/// slaves that animate toward [AuthPose.of(target)]; they never decide state.
///
/// Forward moves commit [node] early so only one flame layout is visible.
/// Backward moves animate channels out first, then commit [node].
class AuthFlowController extends ChangeNotifier {
  AuthFlowController({
    required TickerProvider vsync,
    required bool reduceMotion,
  })  : _reduceMotion = reduceMotion,
        forms = AuthFormState() {
    intro = AnimationController(
      vsync: vsync,
      duration: AuthMotion.duration,
    );
    burst = AnimationController(
      vsync: vsync,
      duration: AuthMotion.duration,
    );
    select = AnimationController(
      vsync: vsync,
      duration: AuthMotion.duration,
    );
    zoom = AnimationController(
      vsync: vsync,
      duration: AuthMotion.duration,
    );
  }

  final AuthFormState forms;
  final bool _reduceMotion;

  late final AnimationController intro;
  late final AnimationController burst;
  late final AnimationController select;
  late final AnimationController zoom;

  AuthNode node = AuthNode.launch;
  bool transitioning = false;

  final List<AuthNode> forwardStack = [];
  int pendingNavSteps = 0;
  int _animToken = 0;
  bool _navDriving = false;
  Future<void> _transitionChain = Future.value();

  /// True while any transition animation is running — UI should ignore input.
  bool get isBusy => transitioning || _navDriving;

  Listenable get repaint => Listenable.merge([intro, burst, select, zoom]);

  void touchForms() => notifyListeners();

  AuthChoice? get choice => AuthPose.of(node).choice;

  bool get loginZoomVisible =>
      node == AuthNode.loginForm ||
      (node == AuthNode.loginSelected && zoom.value > 0.001);

  bool get signupZoomVisible =>
      node == AuthNode.signupForm ||
      (node == AuthNode.signupSelected && zoom.value > 0.001);

  /// Login/signup fields only appear once zoom is nearly complete.
  bool get formVisible => zoom.value > 0.86;

  bool get formInteractive => zoom.value > 0.92 && !transitioning;

  bool get showMainFlow => node != AuthNode.launch;

  bool get showSelectingUi => node.showsSelection;

  @override
  void dispose() {
    intro.dispose();
    burst.dispose();
    select.dispose();
    zoom.dispose();
    super.dispose();
  }

  Future<void> begin() => _enqueue(_beginImpl);

  Future<void> _beginImpl() async {
    if (_reduceMotion) {
      await _snapTo(AuthNode.idle);
      return;
    }
    await intro.forward();
    await _snapTo(AuthNode.idle);
  }

  void skipLaunch() {
    if (node != AuthNode.launch) return;
    intro.stop();
    _clearHistory();
    _snapTo(AuthNode.idle);
  }

  Future<void> ignite() => _enqueue(_igniteImpl);

  Future<void> _igniteImpl() async {
    if (node != AuthNode.idle || transitioning) return;
    HapticFeedback.mediumImpact();
    _clearHistory();
    if (_reduceMotion) {
      await _snapTo(AuthNode.authChoice);
      return;
    }
    await _animateForwardTo(
      AuthNode.authChoice,
      onComplete: HapticFeedback.lightImpact,
    );
  }

  Future<void> pickLogin() {
    _interruptIgniteIfNeeded();
    return _enqueue(_pickLoginImpl);
  }

  Future<void> _pickLoginImpl() async {
    await _ensureAuthChoice();
    if (node != AuthNode.authChoice) return;
    HapticFeedback.selectionClick();
    _clearHistory();
    forms.loginError = null;
    if (_reduceMotion) {
      await _snapTo(AuthNode.loginForm);
      return;
    }
    await _animatePickToForm(AuthChoice.login);
  }

  Future<void> pickSignup() {
    _interruptIgniteIfNeeded();
    return _enqueue(_pickSignupImpl);
  }

  Future<void> _pickSignupImpl() async {
    await _ensureAuthChoice();
    if (node != AuthNode.authChoice) return;
    HapticFeedback.selectionClick();
    _clearHistory();
    forms.resetSignup();
    if (_reduceMotion) {
      await _snapTo(AuthNode.signupForm);
      return;
    }
    await _animatePickToForm(AuthChoice.signup);
  }

  Future<void> retryLoginZoom() => _enqueue(_retryLoginZoomImpl);

  Future<void> _retryLoginZoomImpl() async {
    if (node != AuthNode.loginSelected || transitioning) return;
    _clearHistory();
    forms.loginError = null;
    await _animateForwardToForm(AuthNode.loginForm);
  }

  void signupBackStep() {
    final prev = forms.signupStep.previous;
    if (prev == null) return;
    forms.signupStep = prev;
    forms.signupError = null;
    notifyListeners();
  }

  void signupAdvanceStep() {
    final next = forms.signupStep.next;
    if (next != null) {
      forms.signupStep = next;
      forms.signupError = null;
      notifyListeners();
    }
  }

  Future<void> navigateBack() => _enqueue(_navigateBackImpl);

  Future<void> _navigateBackImpl() async {
    if (node == AuthNode.signupForm && forms.signupStep.previous != null) {
      signupBackStep();
      return;
    }
    if (node.back == null) return;
    pendingNavSteps--;
    await _driveNavigation();
  }

  Future<void> navigateForward() => _enqueue(_navigateForwardImpl);

  Future<void> _navigateForwardImpl() async {
    if (forwardStack.isEmpty || node == AuthNode.launch) return;
    pendingNavSteps++;
    await _driveNavigation();
  }

  bool handlesBackInFlow() {
    return node != AuthNode.launch && node != AuthNode.idle;
  }

  void _clearHistory() {
    forwardStack.clear();
    pendingNavSteps = 0;
    _animToken++;
    transitioning = false;
  }

  Future<void> _enqueue(Future<void> Function() action) {
    final run = _transitionChain.then((_) => action());
    _transitionChain = run.catchError((_) {});
    return run;
  }

  Future<void> _driveNavigation() async {
    if (_navDriving) return;
    _navDriving = true;
    while (pendingNavSteps != 0) {
      if (pendingNavSteps < 0) {
        pendingNavSteps++;
        final prev = node.back;
        if (prev == null) continue;
        forwardStack.add(node);
        if (prev == AuthNode.signupForm) forms.resetSignup();
        await _animateBackTo(prev);
      } else {
        pendingNavSteps--;
        if (forwardStack.isEmpty) continue;
        final next = forwardStack.removeLast();
        await _animateForwardTo(next);
      }
    }
    _navDriving = false;
    if (pendingNavSteps != 0) await _driveNavigation();
  }

  void _interruptIgniteIfNeeded() {
    if (node != AuthNode.idle) return;
    if (!transitioning && burst.value <= 0.001) return;

    _animToken++;
    burst.stop();
    node = AuthNode.authChoice;
    transitioning = false;
    _applyPose(AuthPose.of(AuthNode.authChoice));
    notifyListeners();
  }

  Future<void> _ensureAuthChoice() async {
    if (node == AuthNode.authChoice) return;
    if (node != AuthNode.idle) return;

    _interruptIgniteIfNeeded();
  }

  Future<void> _snapTo(AuthNode target) async {
    _animToken++;
    transitioning = false;
    node = target;
    if (target == AuthNode.signupForm) forms.resetSignup();
    _applyPose(AuthPose.of(target));
    notifyListeners();
  }

  Future<void> _animateChannel(
    AnimationController controller,
    double target, {
    Curve curve = AuthMotion.flow,
    Duration? duration,
  }) async {
    if ((target - controller.value).abs() <= 0.001) return;
    await controller.animateTo(
      target,
      duration: duration ?? AuthMotion.duration,
      curve: curve,
    );
  }

  Future<void> _animatePickToForm(AuthChoice choice) async {
    final token = ++_animToken;
    transitioning = true;

    final selected =
        choice == AuthChoice.login ? AuthNode.loginSelected : AuthNode.signupSelected;
    final form =
        choice == AuthChoice.login ? AuthNode.loginForm : AuthNode.signupForm;

    node = selected;
    notifyListeners();

    final selectFuture = _animateChannel(select, 1, curve: AuthMotion.enter);
    await Future<void>.delayed(
      Duration(milliseconds: (AuthMotion.duration.inMilliseconds * 0.55).round()),
    );
    if (token != _animToken) return;

    if (form == AuthNode.signupForm) forms.resetSignup();

    final zoomFuture = _animateChannel(zoom, 1, curve: AuthMotion.zoomCurve);
    await Future.wait([selectFuture, zoomFuture]);
    if (token != _animToken) return;

    node = form;
    transitioning = false;
    _applyPose(AuthPose.of(form));
    notifyListeners();
  }

  /// Forward: commit [target] node first, then animate channels in.
  Future<void> _animateForwardTo(
    AuthNode target, {
    VoidCallback? onComplete,
  }) async {
    if (_reduceMotion) {
      await _snapTo(target);
      return;
    }

    if (target.isForm) {
      await _animateForwardToForm(target);
      onComplete?.call();
      return;
    }

    // Ignite: burst on idle first, then reveal split — avoids blank flash.
    if (target == AuthNode.authChoice && node == AuthNode.idle) {
      final token = ++_animToken;
      transitioning = true;
      notifyListeners();
      await _animateChannel(burst, 1, curve: AuthMotion.enter);
      if (token != _animToken) return;
      node = AuthNode.authChoice;
      transitioning = false;
      notifyListeners();
      onComplete?.call();
      return;
    }

    final token = ++_animToken;
    transitioning = true;
    node = target;
    notifyListeners();

    await _runChannelAnimations(AuthPose.of(target));
    if (token != _animToken) return;

    transitioning = false;
    _applyPose(AuthPose.of(target));
    onComplete?.call();
    notifyListeners();
  }

  Future<void> _animateForwardToForm(AuthNode form) async {
    final token = ++_animToken;
    transitioning = true;

    final selected = form == AuthNode.loginForm
        ? AuthNode.loginSelected
        : AuthNode.signupSelected;

    if (form == AuthNode.signupForm) forms.resetSignup();

    if (node != selected) {
      node = selected;
      notifyListeners();
      await _animateChannel(select, 1, curve: AuthMotion.enter);
      if (token != _animToken) return;
    }

    await _animateChannel(zoom, 1, curve: AuthMotion.zoomCurve);
    if (token != _animToken) return;

    node = form;
    transitioning = false;
    _applyPose(AuthPose.of(form));
    notifyListeners();
  }

  /// Backward: animate channels out while keeping the current layout visible,
  /// then commit [target] node.
  Future<void> _animateBackTo(AuthNode target) async {
    if (_reduceMotion) {
      await _snapTo(target);
      return;
    }

    final token = ++_animToken;
    transitioning = true;
    notifyListeners();

    final toPose = AuthPose.of(target);

    // Collapse split back to single idle flame.
    if (target == AuthNode.idle && node == AuthNode.authChoice) {
      await _animateChannel(
        burst,
        0,
        curve: AuthMotion.back,
        duration: AuthMotion.backDuration,
      );
      if (token != _animToken) return;
      node = AuthNode.idle;
      transitioning = false;
      _applyPose(toPose);
      notifyListeners();
      return;
    }

    if (node.isForm && zoom.value > toPose.zoom + 0.001) {
      await _animateChannel(
        zoom,
        toPose.zoom,
        curve: AuthMotion.back,
        duration: AuthMotion.backDuration,
      );
      if (token != _animToken) return;
    }

    if (node.isForm) {
      node = node == AuthNode.loginForm
          ? AuthNode.loginSelected
          : AuthNode.signupSelected;
      notifyListeners();
    }

    if (node.showsSelection && select.value > toPose.select + 0.001) {
      await _animateChannel(
        select,
        toPose.select,
        curve: AuthMotion.back,
        duration: AuthMotion.backDuration,
      );
      if (token != _animToken) return;
    }

    if (node.showsSelection && target == AuthNode.authChoice) {
      node = AuthNode.authChoice;
      notifyListeners();
    }

    if (burst.value > toPose.burst + 0.001) {
      await _animateChannel(
        burst,
        toPose.burst,
        curve: AuthMotion.back,
        duration: AuthMotion.backDuration,
      );
      if (token != _animToken) return;
    }

    node = target;
    transitioning = false;
    _applyPose(toPose);
    notifyListeners();
  }

  Future<void> _runChannelAnimations(AuthPose pose) async {
    await Future.wait([
      _animateChannel(burst, pose.burst),
      _animateChannel(select, pose.select, curve: AuthMotion.enter),
      _animateChannel(zoom, pose.zoom, curve: AuthMotion.zoomCurve),
    ]);
  }

  void _applyPose(AuthPose pose) {
    burst.value = pose.burst;
    select.value = pose.select;
    zoom.value = pose.zoom;
  }
}
