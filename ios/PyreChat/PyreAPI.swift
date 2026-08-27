import Foundation
import Combine

struct User: Codable, Identifiable {
	let id: String
	let username: String
	let displayName: String
	let snapScore: Int

	enum CodingKeys: String, CodingKey {
		case id, username
		case displayName
		case snapScore
	}
}

struct Friend: Identifiable {
	let id: String
	let username: String
	let displayName: String
}

struct ChatMember: Identifiable {
	let id: String
	let username: String
	let displayName: String
}

struct ChatRow: Identifiable {
	let id: String
	let isGroup: Bool
	let name: String?
	let members: [ChatMember]
	let lastBody: String?
	let lastKind: String?
	let unopenedSnaps: Int
	let streak: Int

	var title: String {
		if isGroup { return name ?? "Group" }
		return members.first?.displayName ?? "Chat"
	}

	var subtitle: String {
		if unopenedSnaps > 0 { return "New Pyre" }
		if lastKind == "text", let lastBody, !lastBody.isEmpty { return lastBody }
		if let lastKind { return lastKind.capitalized }
		return "Tap to chat"
	}
}

struct ChatMessage: Identifiable {
	let id: String
	let senderId: String
	let displayName: String
	let kind: String
	let body: String
}

enum APIError: LocalizedError {
	case http(Int, String)
	case badResponse
	var errorDescription: String? {
		switch self {
		case .http(_, let msg): msg
		case .badResponse: "Bad response"
		}
	}
}

@MainActor
final class SessionStore: ObservableObject {
	@Published var token: String?
	@Published var user: User?

	private let tokenKey = "pyre_token"
	private let userKey = "pyre_user"

	init() {
		token = UserDefaults.standard.string(forKey: tokenKey)
		if let data = UserDefaults.standard.data(forKey: userKey),
		   let u = try? JSONDecoder().decode(User.self, from: data) {
			user = u
		}
	}

	func save(token: String, user: User) {
		self.token = token
		self.user = user
		UserDefaults.standard.set(token, forKey: tokenKey)
		if let data = try? JSONEncoder().encode(user) {
			UserDefaults.standard.set(data, forKey: userKey)
		}
	}

	func clear() {
		token = nil
		user = nil
		UserDefaults.standard.removeObject(forKey: tokenKey)
		UserDefaults.standard.removeObject(forKey: userKey)
	}
}

final class PyreClient {
	let origin = "https://chat.pyrearms.dev"
	var token: String?

	private func request(path: String, method: String = "GET", body: Data? = nil, contentType: String? = nil) async throws -> [String: Any] {
		var req = URLRequest(url: URL(string: origin + path)!)
		req.httpMethod = method
		if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
		if let body {
			req.httpBody = body
			req.setValue(contentType ?? "application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
		}
		let (data, res) = try await URLSession.shared.data(for: req)
		guard let http = res as? HTTPURLResponse else { throw APIError.badResponse }
		let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
		if http.statusCode >= 400 {
			throw APIError.http(http.statusCode, json["error"] as? String ?? "Error \(http.statusCode)")
		}
		return json
	}

	func me() async throws -> User {
		let json = try await request(path: "/api/me")
		guard let u = json["user"] as? [String: Any] else { throw APIError.badResponse }
		return parseUser(u)
	}

	func login(username: String, password: String) async throws -> User {
		let body = try JSONSerialization.data(withJSONObject: ["username": username, "password": password])
		let json = try await request(path: "/api/auth/login", method: "POST", body: body)
		guard let token = json["token"] as? String, let u = json["user"] as? [String: Any] else { throw APIError.badResponse }
		self.token = token
		return parseUser(u)
	}

	func signup(username: String, password: String, displayName: String, birthday: String) async throws -> (User, String?) {
		let payload: [String: Any] = ["username": username, "password": password, "displayName": displayName, "birthday": birthday]
		let body = try JSONSerialization.data(withJSONObject: payload)
		let json = try await request(path: "/api/auth/signup", method: "POST", body: body)
		guard let token = json["token"] as? String, let u = json["user"] as? [String: Any] else { throw APIError.badResponse }
		self.token = token
		return (parseUser(u), json["recoveryKey"] as? String)
	}

	func logout() async {
		_ = try? await request(path: "/api/auth/logout", method: "POST", body: Data("{}".utf8))
		token = nil
	}

	func chats() async throws -> [ChatRow] {
		let json = try await request(path: "/api/chats")
		let arr = json["chats"] as? [[String: Any]] ?? []
		return arr.map(parseChat)
	}

	func messages(chatId: String) async throws -> [ChatMessage] {
		let json = try await request(path: "/api/chats/\(chatId)/messages")
		let arr = json["messages"] as? [[String: Any]] ?? []
		return arr.map(parseMessage)
	}

	func sendMessage(chatId: String, body: String) async throws {
		let data = try JSONSerialization.data(withJSONObject: ["kind": "text", "body": body])
		_ = try await request(path: "/api/chats/\(chatId)/messages", method: "POST", body: data)
	}

	func friends() async throws -> [Friend] {
		let json = try await request(path: "/api/friends")
		let arr = json["friends"] as? [[String: Any]] ?? []
		return arr.map(parseFriend)
	}

	func searchUsers(_ q: String) async throws -> [Friend] {
		guard let enc = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return [] }
		let json = try await request(path: "/api/users/search?q=\(enc)")
		let arr = json["users"] as? [[String: Any]] ?? []
		return arr.map(parseFriend)
	}

	func addFriend(username: String) async throws {
		let body = try JSONSerialization.data(withJSONObject: ["username": username])
		_ = try await request(path: "/api/friends/add", method: "POST", body: body)
	}

	func friendAdds() async throws -> (incoming: [Friend], suggestions: [Friend]) {
		let json = try await request(path: "/api/friends/adds")
		let incoming = (json["incoming"] as? [[String: Any]] ?? []).map(parseFriend)
		let suggestions = (json["suggestions"] as? [[String: Any]] ?? []).map(parseFriend)
		return (incoming, suggestions)
	}

	func upload(data: Data, mime: String) async throws -> String {
		var req = URLRequest(url: URL(string: origin + "/api/media")!)
		req.httpMethod = "POST"
		req.httpBody = data
		req.setValue(mime, forHTTPHeaderField: "Content-Type")
		if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
		let (resp, res) = try await URLSession.shared.data(for: req)
		guard let http = res as? HTTPURLResponse, http.statusCode < 400,
		      let json = try? JSONSerialization.jsonObject(with: resp) as? [String: Any],
		      let key = json["key"] as? String else {
			throw APIError.badResponse
		}
		return key
	}

	func sendSnap(mediaKey: String, kind: String, recipientIds: [String], caption: String) async throws {
		let payload: [String: Any] = ["mediaKey": mediaKey, "kind": kind, "caption": caption, "recipientIds": recipientIds]
		let body = try JSONSerialization.data(withJSONObject: payload)
		_ = try await request(path: "/api/snaps", method: "POST", body: body)
	}

	private func parseUser(_ o: [String: Any]) -> User {
		User(
			id: o["id"] as? String ?? "",
			username: o["username"] as? String ?? "",
			displayName: o["displayName"] as? String ?? o["username"] as? String ?? "",
			snapScore: o["snapScore"] as? Int ?? 0
		)
	}

	private func parseFriend(_ o: [String: Any]) -> Friend {
		Friend(
			id: o["id"] as? String ?? "",
			username: o["username"] as? String ?? "",
			displayName: o["display_name"] as? String ?? o["username"] as? String ?? ""
		)
	}

	private func parseChat(_ o: [String: Any]) -> ChatRow {
		let members = (o["members"] as? [[String: Any]] ?? []).map { m in
			ChatMember(
				id: m["id"] as? String ?? "",
				username: m["username"] as? String ?? "",
				displayName: m["display_name"] as? String ?? m["username"] as? String ?? ""
			)
		}
		let last = o["last"] as? [String: Any]
		return ChatRow(
			id: o["id"] as? String ?? "",
			isGroup: (o["is_group"] as? Int ?? 0) == 1,
			name: o["name"] as? String,
			members: members,
			lastBody: last?["body"] as? String,
			lastKind: last?["kind"] as? String,
			unopenedSnaps: o["unopenedSnaps"] as? Int ?? 0,
			streak: o["streak"] as? Int ?? 0
		)
	}

	private func parseMessage(_ o: [String: Any]) -> ChatMessage {
		ChatMessage(
			id: o["id"] as? String ?? "",
			senderId: o["sender_id"] as? String ?? "",
			displayName: o["display_name"] as? String ?? o["username"] as? String ?? "",
			kind: o["kind"] as? String ?? "text",
			body: o["body"] as? String ?? ""
		)
	}
}
