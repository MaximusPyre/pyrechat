import 'dart:math' as math;

class AuthBurstLayout {
  AuthBurstLayout._();

  static const burstCount = 10;
  static const sparkCount = 14;

  static List<double> burstAngles() {
    final rng = math.Random(42);
    return List.generate(
      burstCount,
      (i) => (i / burstCount) * math.pi * 2 + rng.nextDouble() * 0.35,
    );
  }

  static List<double> sparkSeeds() {
    final rng = math.Random(42);
    return List.generate(sparkCount, (_) => rng.nextDouble());
  }
}
