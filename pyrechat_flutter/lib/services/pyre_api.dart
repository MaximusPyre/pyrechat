import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:pyrechat_flutter/models/user.dart';

class PyreApiException implements Exception {
  PyreApiException(this.message, [this.statusCode]);

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class PyreApi {
  PyreApi({this.origin = 'https://chat.pyrearms.dev'});

  final String origin;

  Future<({PyreUser user, String token})> login({
    required String username,
    required String password,
  }) async {
    final res = await http.post(
      Uri.parse('$origin/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );
    final body = _decode(res);
    if (res.statusCode >= 400) {
      throw PyreApiException(
        body['error'] as String? ?? 'Could not log in',
        res.statusCode,
      );
    }
    return (
      user: PyreUser.fromJson(body['user'] as Map<String, dynamic>),
      token: body['token'] as String,
    );
  }

  Future<({PyreUser user, String token, String? recoveryKey})> signup({
    required String username,
    required String password,
    required String displayName,
    required String birthday,
  }) async {
    final res = await http.post(
      Uri.parse('$origin/api/auth/signup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'username': username,
        'password': password,
        'displayName': displayName,
        'birthday': birthday,
      }),
    );
    final body = _decode(res);
    if (res.statusCode >= 400) {
      throw PyreApiException(
        body['error'] as String? ?? 'Could not sign up',
        res.statusCode,
      );
    }
    return (
      user: PyreUser.fromJson(body['user'] as Map<String, dynamic>),
      token: body['token'] as String,
      recoveryKey: body['recoveryKey'] as String?,
    );
  }

  Map<String, dynamic> _decode(http.Response res) {
    if (res.body.isEmpty) return {};
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
