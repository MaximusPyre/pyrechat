import SwiftUI

struct ContentView: View {
	@State private var username = ""
	@State private var password = ""

	var body: some View {
		ZStack {
			Color(red: 20 / 255, green: 14 / 255, blue: 11 / 255).ignoresSafeArea()
			VStack(spacing: 16) {
				Text("PyreChat")
					.font(.largeTitle.weight(.black))
					.foregroundStyle(Color(red: 251 / 255, green: 246 / 255, blue: 240 / 255))
				Text("Native iOS shell. Device builds need an Apple Developer account and a Mac runner with signing secrets. This project compiles for the simulator in CI without a Mac on your desk.")
					.font(.subheadline.weight(.semibold))
					.foregroundStyle(Color(red: 196 / 255, green: 164 / 255, blue: 142 / 255))
					.multilineTextAlignment(.center)
					.padding(.horizontal, 24)
				TextField("Username", text: $username)
					.textInputAutocapitalization(.never)
					.padding(12)
					.background(Color(red: 31 / 255, green: 22 / 255, blue: 18 / 255))
					.clipShape(RoundedRectangle(cornerRadius: 12))
					.foregroundStyle(.white)
					.padding(.horizontal, 24)
				SecureField("Password", text: $password)
					.padding(12)
					.background(Color(red: 31 / 255, green: 22 / 255, blue: 18 / 255))
					.clipShape(RoundedRectangle(cornerRadius: 12))
					.foregroundStyle(.white)
					.padding(.horizontal, 24)
				Text("Camera capture ships on Android first. iOS AVFoundation joins when TestFlight is available.")
					.font(.footnote)
					.foregroundStyle(Color(red: 196 / 255, green: 164 / 255, blue: 142 / 255))
					.multilineTextAlignment(.center)
					.padding(.horizontal, 28)
			}
		}
	}
}

#Preview {
	ContentView()
}
