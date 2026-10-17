import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var draft = Profile()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    ProfileForm(profile: $draft)
                    VStack(alignment: .leading, spacing: 10) {
                        Link("How windext reads the wind", destination: URL(string: "https://wind.oooooooo.dev")!)
                        Link("Privacy", destination: URL(string: "https://wind.oooooooo.dev/privacy")!)
                        Text("Weather data © Open-Meteo. Spots © OpenStreetMap contributors and the windext community.").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .padding(24)
            }
            .navigationTitle("Your profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { model.profile = draft; dismiss() } }
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .onAppear { draft = model.profile ?? Profile() }
        }
        .tint(.primary)
    }
}
