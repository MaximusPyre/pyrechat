import 'package:flutter/material.dart';

import 'package:pyrechat_flutter/app/pyre_router.dart';
import 'package:pyrechat_flutter/navigation/pyre_page.dart';
import 'package:pyrechat_flutter/theme/pyre_theme.dart';

class PyreChatApp extends StatelessWidget {
  const PyreChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PyreChat',
      debugShowCheckedModeBanner: false,
      theme: pyreTheme(),

      initialRoute: PyreRoutes.splash,
      onGenerateRoute: PyreRouter.onGenerateRoute,
    );
  }
}