import 'package:flutter/material.dart';
import 'package:pyrechat_flutter/screens/splash_auth_screen.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PyreChatApp());
}

class PyreChatApp extends StatelessWidget {
  const PyreChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PyreChat',
      debugShowCheckedModeBanner: false,
      theme: pyreTheme(),
      home: const SplashAuthScreen(),
    );
  }
}
