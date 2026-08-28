import 'dart:convert';

import 'package:pyrechat_flutter/models/user.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static const _tokenKey = 'pyre_token';
  static const _userKey = 'pyre_user';

  Future<String?> get token async =>
      (await SharedPreferences.getInstance()).getString(_tokenKey);

  Future<PyreUser?> get user async {
    final raw =
        (await SharedPreferences.getInstance()).getString(_userKey);
    if (raw == null) return null;
    return PyreUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> save({required String token, required PyreUser user}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(
      _userKey,
      jsonEncode({
        'id': user.id,
        'username': user.username,
        'displayName': user.displayName,
      }),
    );
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }
}
