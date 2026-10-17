import SwiftUI

struct AddSpotView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var result: SpotSearchResponse?
    @State private var searching = false
    @State private var error = false

    var body: some View {
        NavigationStack {
            List {
                if let r = result {
                    if !r.spots.isEmpty {
                        Section("Known spots") {
                            ForEach(r.spots, id: \.id) { s in
                                Button { pick(Spot(id: s.id, name: s.name, country: s.country, lat: s.lat, lon: s.lon, serverId: s.id, facing: s.facing_deg)) } label: {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(s.name).font(.body.weight(.medium))
                                        Text(s.country.isEmpty ? (s.status == "seed" ? String(localized: "From OpenStreetMap") : "") : s.country).font(.footnote).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                    if !r.places.isEmpty {
                        Section("Places") {
                            ForEach(r.places, id: \.self) { p in
                                Button { pick(Spot(id: "\(p.lat),\(p.lon)", name: p.name, country: p.country, lat: p.lat, lon: p.lon, serverId: nil, facing: nil)) } label: {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(p.name).font(.body.weight(.medium))
                                        Text([p.admin, p.country].filter { !$0.isEmpty }.joined(separator: ", ")).font(.footnote).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                    if r.spots.isEmpty && r.places.isEmpty { Text("Nothing found. Try the town name.").foregroundStyle(.secondary) }
                } else if error {
                    Text("No connection. Try again.").foregroundStyle(.secondary)
                } else {
                    Text("Type a spot or a town: Leucate, Tarifa, Cumbuco…").foregroundStyle(.secondary)
                }
            }
            .tint(.primary)
            .overlay { if searching { ProgressView() } }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: Text("Spot or town"))
            .task(id: query) { await search() }
            .navigationTitle("Add a spot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { result = nil; return }
        try? await Task.sleep(for: .milliseconds(350))   // debounce typing
        guard !Task.isCancelled else { return }
        searching = true; defer { searching = false }
        do { result = try await API.search(q); error = false } catch { if !Task.isCancelled { self.error = true } }
    }

    private func pick(_ spot: Spot) { model.add(spot); dismiss() }
}
