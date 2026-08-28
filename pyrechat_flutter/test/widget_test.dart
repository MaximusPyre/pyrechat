import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pyrechat_flutter/main.dart';

void main() {
  testWidgets('shows centered flame on orange splash', (tester) async {
    await tester.pumpWidget(const PyreChatApp());

    expect(find.byType(Image), findsOneWidget);
  });
}
