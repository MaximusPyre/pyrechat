import SwiftUI
import AVFoundation
import UIKit

// MARK: - Root

struct RootView: View {
	@StateObject private var session = SessionStore()
	@State private var booting = true
	@State private var tab: AppTab = .capture
	@State private var api = PyreClient()
	@State private var overlay: AppOverlay?

	enum AppOverlay: Identifiable {
		case thread(ChatRow)
		case addFriends
		case send(Data, String, String)
		case recovery(String)

		var id: String {
			switch self {
			case .thread(let c): "t-\(c.id)"
			case .addFriends: "add"
			case .send: "send"
			case .recovery: "rec"
			}
		}
	}

	var body: some View {
		ZStack {
			Pyre.ink.ignoresSafeArea()
			if booting {
				ProgressView().tint(Pyre.ember)
			} else if session.user == nil {
				AuthView(api: api, session: session)
			} else if let me = session.user {
				VStack(spacing: 0) {
					Group {
						switch tab {
						case .chat:
							ChatListView(api: api, meId: me.id, onOpen: { overlay = .thread($0) }, onAdd: { overlay = .addFriends })
						case .capture:
							CameraTabView { data, kind, mime in overlay = .send(data, kind, mime) }
						case .profile:
							ProfileTabView(me: me, api: api, session: session)
						}
					}
					.frame(maxWidth: .infinity, maxHeight: .infinity)
					PyreBottomNav(tab: $tab)
				}
				.sheet(item: $overlay) { item in
					switch item {
					case .thread(let chat):
						ChatThreadView(api: api, meId: me.id, chat: chat)
					case .addFriends:
						AddFriendsView(api: api)
					case .send(let data, let kind, let mime):
						SendPyreView(api: api, data: data, kind: kind, mime: mime)
					case .recovery(let key):
						RecoveryView(key: key) { overlay = nil }
					}
				}
			}
		}
		.task {
			api.token = session.token
			if session.token == nil {
				booting = false
				return
			}
			do {
				let user = try await api.me()
				session.user = user
			} catch {
				session.clear()
			}
			booting = false
		}
	}
}

// MARK: - Auth

struct AuthView: View {
	let api: PyreClient
	@ObservedObject var session: SessionStore
	@State private var mode = 0
	@State private var username = ""
	@State private var password = ""
	@State private var displayName = ""
	@State private var birthday = ""
	@State private var error: String?
	@State private var busy = false

	var body: some View {
		ScrollView {
			VStack(spacing: 16) {
				Text("🔥").font(.largeTitle)
				Text("PyreChat").font(.largeTitle.weight(.black)).foregroundStyle(Pyre.paper)
				PyreCard {
					VStack(alignment: .leading, spacing: 12) {
						Text(mode == 0 ? "Welcome back" : "Create account").font(.title3.weight(.semibold)).foregroundStyle(Pyre.paper)
						PyreField(label: "Username", text: $username)
						if mode == 1 {
							PyreField(label: "Display name", text: $displayName)
							PyreField(label: "Birthday (YYYY-MM-DD)", text: $birthday)
						}
						PyreField(label: "Password", text: $password, secure: true)
					}
				}
				if let error { Text(error).foregroundStyle(Pyre.error).font(.subheadline) }
				PyreButton(title: mode == 0 ? "Log in" : "Create account", loading: busy) {
					Task { await submit() }
				}
				PyreGhostButton(title: mode == 0 ? "Create account" : "Have an account? Log in") { mode = mode == 0 ? 1 : 0 }
			}
			.padding(24)
		}
	}
	func submit() async {
		busy = true
		error = nil
		defer { busy = false }
		do {
			if mode == 0 {
				let user = try await api.login(username: username.trimmingCharacters(in: .whitespaces), password: password)
				session.save(token: api.token ?? "", user: user)
			} else {
				let (user, _) = try await api.signup(
					username: username.trimmingCharacters(in: .whitespaces),
					password: password,
					displayName: displayName.isEmpty ? username : displayName,
					birthday: birthday
				)
				session.save(token: api.token ?? "", user: user)
			}
		} catch {
			self.error = error.localizedDescription
		}
	}
}

// MARK: - Chat

struct ChatListView: View {
	let api: PyreClient
	let meId: String
	var onOpen: (ChatRow) -> Void
	var onAdd: () -> Void
	@State private var chats: [ChatRow] = []
	@State private var q = ""
	@State private var loading = true
	@State private var error: String?

	var shown: [ChatRow] {
		if q.isEmpty { return chats }
		let needle = q.lowercased()
		return chats.filter { $0.title.lowercased().contains(needle) || $0.members.contains { $0.username.lowercased().contains(needle) } }
	}

	var body: some View {
		VStack(alignment: .leading, spacing: 12) {
			HStack {
				PyreTopBar(title: "Chat", subtitle: "Messages with friends")
				Spacer()
				Button(action: onAdd) {
					Image(systemName: "person.badge.plus").foregroundStyle(Pyre.ember)
				}
			}
			PyreField(label: "Search", text: $q)
			if let error { Text(error).foregroundStyle(Pyre.error) }
			if loading {
				Spacer()
				ProgressView().tint(Pyre.ember).frame(maxWidth: .infinity)
				Spacer()
			} else if shown.isEmpty {
				Spacer()
				Text("No chats yet").font(.title3.weight(.semibold)).foregroundStyle(Pyre.paper)
				Text("Add friends to start messaging.").foregroundStyle(Pyre.mute)
				Spacer()
			} else {
				ScrollView {
					LazyVStack(spacing: 10) {
						ForEach(shown) { chat in
							Button { onOpen(chat) } label: {
								PyreCard {
									HStack {
										VStack(alignment: .leading, spacing: 4) {
											HStack {
												Text(chat.title).fontWeight(.semibold).foregroundStyle(Pyre.paper)
												if chat.streak > 0 { Text("🔥\(chat.streak)").foregroundStyle(Pyre.ember).font(.caption) }
											}
											Text(chat.subtitle).font(.subheadline).foregroundStyle(chat.unopenedSnaps > 0 ? Pyre.ember : Pyre.mute).lineLimit(1)
										}
										Spacer()
										if chat.unopenedSnaps > 0 {
											Text("\(chat.unopenedSnaps)").font(.caption.weight(.bold)).padding(.horizontal, 8).padding(.vertical, 4)
												.background(Pyre.ember).foregroundStyle(Pyre.paper).clipShape(Capsule())
										}
									}
								}
							}
						}
					}
				}
			}
		}
		.padding(.horizontal, 20)
		.padding(.top, 8)
		.task { await load() }
	}
	func load() async {
		loading = true
		do { chats = try await api.chats() } catch { error = error.localizedDescription }
		loading = false
	}
}

struct ChatThreadView: View {
	let api: PyreClient
	let meId: String
	let chat: ChatRow
	@Environment(\.dismiss) private var dismiss
	@State private var messages: [ChatMessage] = []
	@State private var draft = ""
	@State private var error: String?
	@State private var busy = false

	var body: some View {
		NavigationStack {
			VStack(spacing: 0) {
				if let error { Text(error).foregroundStyle(Pyre.error).padding(.horizontal) }
				ScrollView {
					LazyVStack(spacing: 8) {
						ForEach(messages) { msg in
							let mine = msg.senderId == meId
							HStack {
								if mine { Spacer() }
								VStack(alignment: .leading, spacing: 2) {
									if !mine { Text(msg.displayName).font(.caption2).foregroundStyle(Pyre.mute) }
									Text(msg.kind == "text" ? msg.body : msg.kind)
										.foregroundStyle(Pyre.paper)
								}
								.padding(.horizontal, 14).padding(.vertical, 10)
								.background(mine ? Pyre.ember.opacity(0.85) : Pyre.row)
								.clipShape(RoundedRectangle(cornerRadius: 16))
								.frame(maxWidth: 280, alignment: mine ? .trailing : .leading)
								if !mine { Spacer() }
							}
						}
					}
					.padding()
				}
				HStack {
					PyreField(label: "Message", text: $draft)
					PyreGhostButton(title: busy ? "…" : "Send") {
						Task { await send() }
					}
				}
				.padding()
			}
			.background(Pyre.ink)
			.navigationTitle(chat.title)
			.navigationBarTitleDisplayMode(.inline)
			.toolbar {
				ToolbarItem(placement: .cancellationAction) {
					Button("Close") { dismiss() }
				}
			}
		}
		.task {
			await refresh()
			while !Task.isCancelled {
				try? await Task.sleep(nanoseconds: 4_000_000_000)
				await refresh()
			}
		}
	}
	func refresh() async {
		do { messages = try await api.messages(chatId: chat.id) } catch { error = error.localizedDescription }
	}
	func send() async {
		let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
		guard !text.isEmpty else { return }
		busy = true
		defer { busy = false }
		do {
			try await api.sendMessage(chatId: chat.id, body: text)
			draft = ""
			await refresh()
		} catch { error = error.localizedDescription }
	}
}

struct AddFriendsView: View {
	let api: PyreClient
	@Environment(\.dismiss) private var dismiss
	@State private var q = ""
	@State private var incoming: [Friend] = []
	@State private var suggestions: [Friend] = []
	@State private var hits: [Friend] = []
	@State private var error: String?

	var body: some View {
		NavigationStack {
			VStack(spacing: 12) {
				PyreField(label: "Search username", text: $q)
				if let error { Text(error).foregroundStyle(Pyre.error) }
				ScrollView {
					LazyVStack(spacing: 8) {
						if !incoming.isEmpty {
							Text("Requests").font(.caption).foregroundStyle(Pyre.mute).frame(maxWidth: .infinity, alignment: .leading)
							ForEach(incoming) { f in friendRow(f, action: "Accept") { Task { try? await api.addFriend(username: f.username); await reload() } } }
						}
						let list = q.count >= 2 ? hits : suggestions
						if !list.isEmpty {
							Text(q.count >= 2 ? "Results" : "Suggested").font(.caption).foregroundStyle(Pyre.mute).frame(maxWidth: .infinity, alignment: .leading)
							ForEach(list) { f in friendRow(f, action: "Add") { Task { try? await api.addFriend(username: f.username); await reload() } } }
						}
					}
				}
			}
			.padding()
			.background(Pyre.ink)
			.navigationTitle("Add friends")
			.toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
		}
		.task { await reload() }
		.onChange(of: q) { _, new in
			Task {
				if new.count < 2 { hits = []; return }
				hits = (try? await api.searchUsers(new)) ?? []
			}
		}
	}
	func friendRow(_ f: Friend, action: String, onAction: @escaping () -> Void) -> some View {
		PyreCard {
			HStack {
				VStack(alignment: .leading) {
					Text(f.displayName).fontWeight(.semibold).foregroundStyle(Pyre.paper)
					Text("@\(f.username)").font(.caption).foregroundStyle(Pyre.mute)
				}
				Spacer()
				PyreGhostButton(title: action, action: onAction)
			}
		}
	}
	func reload() async {
		do {
			let adds = try await api.friendAdds()
			incoming = adds.incoming
			suggestions = adds.suggestions
		} catch { error = error.localizedDescription }
	}
}

// MARK: - Camera

struct CameraTabView: View {
	var onCaptured: (Data, String, String) -> Void
	@State private var authorized = false
	@State private var denied = false

	var body: some View {
		ZStack {
			if authorized {
				CameraPreviewView(onPhoto: { data in onCaptured(data, "photo", "image/jpeg") })
			} else if denied {
				VStack(spacing: 12) {
					Text("Camera access needed").font(.title3.weight(.semibold)).foregroundStyle(Pyre.paper)
					Text("Enable camera in Settings to capture Pyres.").foregroundStyle(Pyre.mute).multilineTextAlignment(.center)
				}
				.padding(32)
			} else {
				ProgressView().tint(Pyre.ember)
			}
			VStack {
				Spacer()
				Text("Tap shutter for photo").font(.caption.weight(.semibold)).foregroundStyle(Pyre.paper.opacity(0.9)).padding(.bottom, 100)
			}
		}
		.task { await requestCamera() }
	}
	func requestCamera() async {
		switch AVCaptureDevice.authorizationStatus(for: .video) {
		case .authorized: authorized = true
		case .notDetermined:
			authorized = await AVCaptureDevice.requestAccess(for: .video)
			denied = !authorized
		default: denied = true
		}
	}
}

struct CameraPreviewView: UIViewControllerRepresentable {
	var onPhoto: (Data) -> Void
	func makeUIViewController(context: Context) -> CameraViewController {
		let vc = CameraViewController()
		vc.onPhoto = onPhoto
		return vc
	}
	func updateUIViewController(_ uiViewController: CameraViewController, context: Context) {}
}

final class CameraViewController: UIViewController, AVCapturePhotoCaptureDelegate {
	var onPhoto: ((Data) -> Void)?
	private let session = AVCaptureSession()
	private let output = AVCapturePhotoOutput()
	private var previewLayer: AVCaptureVideoPreviewLayer?

	override func viewDidLoad() {
		super.viewDidLoad()
		view.backgroundColor = .black
		session.sessionPreset = .photo
		guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
		      let input = try? AVCaptureDeviceInput(device: device),
		      session.canAddInput(input), session.canAddOutput(output) else { return }
		session.addInput(input)
		session.addOutput(output)
		let layer = AVCaptureVideoPreviewLayer(session: session)
		layer.videoGravity = .resizeAspectFill
		layer.frame = view.bounds
		view.layer.addSublayer(layer)
		previewLayer = layer
		let btn = UIButton(type: .system)
		btn.setTitle("", for: .normal)
		btn.backgroundColor = .white
		btn.layer.cornerRadius = 36
		btn.frame = CGRect(x: 0, y: 0, width: 72, height: 72)
		btn.addTarget(self, action: #selector(snap), for: .touchUpInside)
		view.addSubview(btn)
		btn.translatesAutoresizingMaskIntoConstraints = false
		NSLayoutConstraint.activate([
			btn.centerXAnchor.constraint(equalTo: view.centerXAnchor),
			btn.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -48),
			btn.widthAnchor.constraint(equalToConstant: 72),
			btn.heightAnchor.constraint(equalToConstant: 72),
		])
		DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
	}

	override func viewDidLayoutSubviews() {
		super.viewDidLayoutSubviews()
		previewLayer?.frame = view.bounds
	}

	@objc private func snap() {
		let settings = AVCapturePhotoSettings()
		output.capturePhoto(with: settings, delegate: self)
	}

	func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
		guard let data = photo.fileDataRepresentation() else { return }
		DispatchQueue.main.async { self.onPhoto?(data) }
	}
}

struct SendPyreView: View {
	let api: PyreClient
	let data: Data
	let kind: String
	let mime: String
	@Environment(\.dismiss) private var dismiss
	@State private var friends: [Friend] = []
	@State private var picked = Set<String>()
	@State private var caption = ""
	@State private var busy = false
	@State private var error: String?

	var body: some View {
		NavigationStack {
			VStack(spacing: 12) {
				PyreField(label: "Caption", text: $caption)
				if let error { Text(error).foregroundStyle(Pyre.error) }
				ScrollView {
					LazyVStack(spacing: 8) {
						ForEach(friends) { f in
							Button {
								if picked.contains(f.id) { picked.remove(f.id) } else { picked.insert(f.id) }
							} label: {
								PyreCard {
									HStack {
										Text(picked.contains(f.id) ? "✓" : "○").foregroundStyle(Pyre.ember)
										VStack(alignment: .leading) {
											Text(f.displayName).foregroundStyle(Pyre.paper)
											Text("@\(f.username)").font(.caption).foregroundStyle(Pyre.mute)
										}
										Spacer()
									}
								}
							}
						}
					}
				}
				PyreButton(title: busy ? "Sending…" : "Send Pyre", loading: busy) {
					Task { await send() }
				}
			}
			.padding()
			.background(Pyre.ink)
			.navigationTitle("Send Pyre")
			.toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
		}
		.task { friends = (try? await api.friends()) ?? [] }
	}
	func send() async {
		guard !picked.isEmpty else { return }
		busy = true
		defer { busy = false }
		do {
			let key = try await api.upload(data: data, mime: mime)
			try await api.sendSnap(mediaKey: key, kind: kind, recipientIds: Array(picked), caption: caption)
			dismiss()
		} catch { error = error.localizedDescription }
	}
}

// MARK: - Profile

struct ProfileTabView: View {
	let me: User
	let api: PyreClient
	@ObservedObject var session: SessionStore
	@State private var user: User
	@State private var busy = false

	init(me: User, api: PyreClient, session: SessionStore) {
		self.me = me
		self.api = api
		self.session = session
		_user = State(initialValue: me)
	}

	var body: some View {
		ScrollView {
			VStack(alignment: .leading, spacing: 16) {
				PyreTopBar(title: "Profile", subtitle: "@\(user.username)")
				PyreCard {
					HStack {
						VStack(alignment: .leading) {
							Text("Pyre score").font(.caption).foregroundStyle(Pyre.mute)
							Text("\(user.snapScore)").font(.largeTitle.weight(.black)).foregroundStyle(Pyre.ember)
						}
						Spacer()
						Text("🔥").font(.largeTitle)
					}
				}
				PyreButton(title: "Log out", loading: busy) {
					Task {
						busy = true
						await api.logout()
						session.clear()
						busy = false
					}
				}
			}
			.padding(.horizontal, 20)
			.padding(.bottom, 32)
		}
	}
}

struct RecoveryView: View {
	let key: String
	var onDone: () -> Void
	var body: some View {
		VStack(spacing: 16) {
			Text("Recovery key").font(.title2.weight(.bold)).foregroundStyle(Pyre.paper)
			Text(key).foregroundStyle(Pyre.ember).multilineTextAlignment(.center)
			PyreButton(title: "I saved it", action: onDone)
		}
		.padding(24)
		.background(Pyre.ink)
	}
}
