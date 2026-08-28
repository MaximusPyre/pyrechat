import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pyrechat_flutter/app/pyre_chat_app.dart';
import 'package:pyrechat_flutter/widgets/pyre_flame.dart';

void main() {
  testWidgets('Splash split and login form', (tester) async {
    await tester.pumpWidget(const PyreChatApp());
    await tester.pumpAndSettle();

    expect(find.byType(PyreFlame), findsOneWidget);

    await tester.tap(find.byType(PyreFlame));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pumpAndSettle();

    expect(find.text('Log in'), findsOneWidget);
    expect(find.text('Sign up'), findsOneWidget);

    await tester.tap(find.text('Log in'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.widgetWithText(FilledButton, 'Log in'), findsOneWidget);
  });
}
