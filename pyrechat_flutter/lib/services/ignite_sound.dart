import 'package:audioplayers/audioplayers.dart';

/// Plays the ignite fwumph + crackle at ~70ms after tap.
class IgniteSound {
  IgniteSound._();

  static final AudioPlayer _fwumph = AudioPlayer()..setReleaseMode(ReleaseMode.stop);
  static final AudioPlayer _crackle = AudioPlayer()..setReleaseMode(ReleaseMode.stop);
  static var _enabled = true;

  static void setEnabled(bool enabled) => _enabled = enabled;

  static Future<void> play({bool reduceMotion = false}) async {
    if (!_enabled || reduceMotion) return;
    try {
      await Future.wait([
        _fwumph.play(AssetSource('sounds/ignite_fwumph.wav'), volume: 0.7),
        Future<void>.delayed(const Duration(milliseconds: 45), () {
          return _crackle.play(AssetSource('sounds/ignite_crackle.wav'), volume: 0.55);
        }),
      ]);
    } catch (_) {
      // Missing assets or audio focus — silent fail.
    }
  }

  static Future<void> dispose() async {
    await Future.wait([_fwumph.dispose(), _crackle.dispose()]);
  }
}
