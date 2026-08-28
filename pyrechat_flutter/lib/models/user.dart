class PyreUser {
  const PyreUser({
    required this.id,
    required this.username,
    required this.displayName,
  });

  final String id;
  final String username;
  final String displayName;

  factory PyreUser.fromJson(Map<String, dynamic> json) {
    return PyreUser(
      id: json['id'] as String,
      username: json['username'] as String,
      displayName: (json['displayName'] as String?) ?? json['username'] as String,
    );
  }
}
