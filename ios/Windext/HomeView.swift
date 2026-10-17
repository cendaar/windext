import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var adding = false
    @State private var settings = false
    @State private var path: [Spot] = []

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if model.spots.isEmpty { empty } else { list }
            }
            .navigationTitle("windext")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button { settings = true } label: { Image(systemName: "person.crop.circle") }.accessibilityLabel(Text("Settings")) }
                ToolbarItem(placement: .topBarTrailing) { Button { adding = true } label: { Image(systemName: "plus") }.accessibilityLabel(Text("Add a spot")) }
            }
            .sheet(isPresented: $adding) { AddSpotView() }
            .sheet(isPresented: $settings) { SettingsView() }
            .refreshable { await model.refreshAll() }
        }
        .tint(.primary)
        #if DEBUG
        .onAppear { if ProcessInfo.processInfo.arguments.contains("-openFirstSpot"), let s = model.spots.first { path = [s] } }
        #endif
    }

    private var list: some View {
        List {
            ForEach(model.spots) { spot in
                NavigationLink(value: spot) { SpotRow(spot: spot) }
            }
            .onDelete { model.remove(at: $0) }
            .onMove { model.move(from: $0, to: $1) }
        }
        .listStyle(.plain)
        .navigationDestination(for: Spot.self) { SpotDetailView(spot: $0) }
    }

    private var empty: some View {
        VStack(spacing: 18) {
            Text("Add your spot").font(.title.weight(.semibold))
            Text("windext reads seven weather models and tells you, in plain words, whether it is worth going and when.")
                .multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button { adding = true } label: {
                Text("Find a spot").font(.headline).padding(.horizontal, 28).padding(.vertical, 14)
                    .foregroundStyle(Color(.systemBackground)).background(Color.primary, in: Capsule())
            }.buttonStyle(.plain)
        }
        .padding(32)
    }
}

struct SpotRow: View {
    @Environment(AppModel.self) private var model
    let spot: Spot

    var body: some View {
        let v = model.verdicts[spot.id]
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(spot.name).font(.title3.weight(.semibold)).lineLimit(1)
                Spacer()
                if model.loading.contains(spot.id) && v == nil { ProgressView() }
            }
            if let v {
                HStack(spacing: 18) {
                    ForEach(v.days, id: \.date) { d in
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("\(d.score)").font(.system(size: 30, weight: .bold)).monospacedDigit()
                            Text(d.day).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
                if let today = v.days.first { Text(today.headline).font(.callout).foregroundStyle(.secondary).lineLimit(2) }
            } else if model.failed.contains(spot.id) {
                Text("No connection. Pull to refresh.").font(.callout).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }
}
