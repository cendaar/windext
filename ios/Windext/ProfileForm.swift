import SwiftUI

extension Sport {
    var label: LocalizedStringKey {
        switch self { case .kitesurf: "Kitesurf"; case .wingfoil: "Wingfoil"; case .windsurf: "Windsurf" }
    }
    var gearLabel: LocalizedStringKey {
        switch self { case .kitesurf: "Your kites"; case .wingfoil: "Your wings"; case .windsurf: "Your sails" }
    }
}
extension Level {
    var label: LocalizedStringKey {
        switch self { case .beginner: "Beginner"; case .intermediate: "Intermediate"; case .expert: "Expert" }
    }
}

/// The four questions: sport, weight, gear, level. Used by onboarding and settings.
struct ProfileForm: View {
    @Binding var profile: Profile

    var body: some View {
        VStack(alignment: .leading, spacing: 36) {
            section("What do you ride?") {
                HStack(spacing: 10) {
                    ForEach(Sport.allCases) { s in
                        Chip(selected: profile.sport == s) {
                            if profile.sport != s { profile.sport = s; profile.sizes = s.defaultSizes }
                        } label: { Text(s.label) }
                    }
                }
            }
            section("Your weight") {
                HStack {
                    Text("\(profile.weightKg) kg").font(.system(size: 40, weight: .semibold)).monospacedDigit()
                    Spacer()
                    Stepper("", value: $profile.weightKg, in: 35...140).labelsHidden()
                }
            }
            section(profile.sport.gearLabel) {
                FlowLayout(spacing: 8) {
                    ForEach(profile.sport.commonSizes, id: \.self) { size in
                        Chip(selected: profile.sizes.contains(size)) {
                            if profile.sizes.contains(size) { if profile.sizes.count > 1 { profile.sizes.removeAll { $0 == size } } }
                            else { profile.sizes.append(size); profile.sizes.sort() }
                        } label: { Text("\(size.formatted()) \(profile.sport.unit)").monospacedDigit() }
                    }
                }
            }
            section("Your level") {
                HStack(spacing: 10) {
                    ForEach(Level.allCases) { l in
                        Chip(selected: profile.level == l) { profile.level = l } label: { Text(l.label) }
                    }
                }
            }
        }
    }

    private func section<Content: View>(_ title: LocalizedStringKey, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.footnote.weight(.semibold)).textCase(.uppercase).tracking(1.2).foregroundStyle(.secondary)
            content()
        }
    }
}

/// Black on white, white on black: selected chips invert.
struct Chip<Label: View>: View {
    var selected: Bool
    var action: () -> Void
    @ViewBuilder var label: () -> Label
    var body: some View {
        Button(action: action) {
            label()
                .font(.body.weight(.medium))
                .padding(.horizontal, 14).padding(.vertical, 9)
                .foregroundStyle(selected ? Color(.systemBackground) : .primary)
                .background(selected ? Color.primary : .clear, in: Capsule())
                .overlay(Capsule().strokeBorder(Color.primary, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: selected)
    }
}

/// Wraps chips onto several lines.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, maxX: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > width, x > 0 { x = 0; y += row + spacing; row = 0 }
            x += s.width + spacing; row = max(row, s.height); maxX = max(maxX, x - spacing)
        }
        return CGSize(width: min(maxX, width), height: y + row)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX, x > bounds.minX { x = bounds.minX; y += row + spacing; row = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; row = max(row, s.height)
        }
    }
}
