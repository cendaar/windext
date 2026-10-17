import SwiftUI

struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @State private var draft = Profile()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("windext").font(.system(size: 44, weight: .bold))
                    Text("Is it worth going? One answer for today, one for tomorrow, for your spot and your gear.")
                        .font(.title3).foregroundStyle(.secondary)
                }
                ProfileForm(profile: $draft)
                Text("Stays on your phone. No account, no tracking.").font(.footnote).foregroundStyle(.secondary)
                Button {
                    model.profile = draft
                    Task { await Notifications.requestPermission() }
                } label: {
                    Text("Continue").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 16)
                        .foregroundStyle(Color(.systemBackground)).background(Color.primary, in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }
            .padding(24)
        }
    }
}
