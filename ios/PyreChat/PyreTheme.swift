import SwiftUI

enum Pyre {
	static let ink = Color(red: 20 / 255, green: 14 / 255, blue: 11 / 255)
	static let panel = Color(red: 31 / 255, green: 22 / 255, blue: 18 / 255)
	static let row = Color(red: 42 / 255, green: 29 / 255, blue: 22 / 255)
	static let paper = Color(red: 251 / 255, green: 246 / 255, blue: 240 / 255)
	static let mute = Color(red: 196 / 255, green: 164 / 255, blue: 142 / 255)
	static let ember = Color(red: 252 / 255, green: 122 / 255, blue: 26 / 255)
	static let error = Color(red: 1, green: 138 / 255, blue: 112 / 255)
	static let success = Color(red: 95 / 255, green: 212 / 255, blue: 154 / 255)
	static let radius: CGFloat = 16
}

struct PyreCard<Content: View>: View {
	@ViewBuilder var content: Content
	var body: some View {
		content
			.frame(maxWidth: .infinity, alignment: .leading)
			.padding(16)
			.background(Pyre.row.opacity(0.65))
			.clipShape(RoundedRectangle(cornerRadius: Pyre.radius))
	}
}

struct PyreField: View {
	let label: String
	@Binding var text: String
	var secure = false
	var body: some View {
		Group {
			if secure {
				SecureField(label, text: $text)
			} else {
				TextField(label, text: $text)
					.textInputAutocapitalization(.never)
					.autocorrectionDisabled()
			}
		}
		.padding(14)
		.background(Pyre.row.opacity(0.45))
		.overlay(RoundedRectangle(cornerRadius: Pyre.radius).stroke(Pyre.mute.opacity(0.35)))
		.clipShape(RoundedRectangle(cornerRadius: Pyre.radius))
		.foregroundStyle(Pyre.paper)
	}
}

struct PyreButton: View {
	let title: String
	var loading = false
	var action: () -> Void
	var body: some View {
		Button(action: action) {
			HStack {
				Spacer()
				if loading { ProgressView().tint(Pyre.paper) }
				else { Text(title).fontWeight(.semibold) }
				Spacer()
			}
			.padding(.vertical, 14)
			.background(Pyre.ember)
			.clipShape(RoundedRectangle(cornerRadius: Pyre.radius))
			.foregroundStyle(Pyre.paper)
		}
		.disabled(loading)
	}
}

struct PyreGhostButton: View {
	let title: String
	var action: () -> Void
	var body: some View {
		Button(title, action: action)
			.fontWeight(.semibold)
			.foregroundStyle(Pyre.ember.opacity(0.9))
	}
}

struct PyreTopBar: View {
	let title: String
	let subtitle: String?
	var body: some View {
		VStack(alignment: .leading, spacing: 4) {
			Text(title).font(.title2.weight(.bold)).foregroundStyle(Pyre.paper)
			if let subtitle {
				Text(subtitle).font(.subheadline).foregroundStyle(Pyre.mute)
			}
		}
		.frame(maxWidth: .infinity, alignment: .leading)
		.padding(.vertical, 8)
	}
}

struct PyreBottomNav: View {
	@Binding var tab: AppTab
	var body: some View {
		HStack {
			ForEach(AppTab.allCases, id: \.self) { item in
				Button {
					tab = item
				} label: {
					VStack(spacing: 4) {
						Image(systemName: item.icon)
						Text(item.label).font(.caption2.weight(.medium))
					}
					.foregroundStyle(tab == item ? Pyre.ember : Pyre.mute)
					.padding(.horizontal, 22)
					.padding(.vertical, 10)
					.background(tab == item ? Pyre.ember.opacity(0.14) : .clear)
					.clipShape(Capsule())
				}
				.frame(maxWidth: .infinity)
			}
		}
		.padding(.horizontal, 12)
		.padding(.vertical, 10)
		.background(Pyre.panel.opacity(0.98))
	}
}

enum AppTab: CaseIterable {
	case chat, capture, profile
	var label: String {
		switch self {
		case .chat: "Chat"
		case .capture: "Capture"
		case .profile: "Profile"
		}
	}
	var icon: String {
		switch self {
		case .chat: "bubble.left"
		case .capture: "camera"
		case .profile: "person"
		}
	}
}
