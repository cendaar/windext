import SwiftUI

struct SpotDetailView: View {
    @Environment(AppModel.self) private var model
    let spot: Spot

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 40) {
                if let v = model.verdicts[spot.id] {
                    if let alerts = v.alerts, !alerts.isEmpty {
                        Text(alerts.joined(separator: " · "))
                            .font(.headline).padding(14).frame(maxWidth: .infinity, alignment: .leading)
                            .foregroundStyle(Color(.systemBackground)).background(Color.primary, in: RoundedRectangle(cornerRadius: 12))
                    }
                    ForEach(v.days, id: \.date) { DayBlock(day: $0) }
                    Text("Updated \(SharedStore.cached(spot.id)?.fetchedAt.formatted(date: .omitted, time: .shortened) ?? "–"). Seven weather models, read for your gear.")
                        .font(.footnote).foregroundStyle(.secondary)
                } else if model.failed.contains(spot.id) {
                    Text("No connection. Pull to refresh.").foregroundStyle(.secondary)
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            .padding(24)
        }
        .navigationTitle(spot.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.refresh(spot) }
        .task { if model.verdicts[spot.id] == nil { await model.refresh(spot) } }
    }
}

struct DayBlock: View {
    let day: VerdictResponse.Day
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .lastTextBaseline) {
                Text(day.day).font(.footnote.weight(.semibold)).textCase(.uppercase).tracking(1.2)
                Spacer()
                Text("\(day.score)").font(.system(size: 64, weight: .bold)).monospacedDigit()
                Text("/10").font(.title3).foregroundStyle(.secondary)
            }
            Text(day.headline).font(.title2.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
            ForEach(day.reasons, id: \.self) { r in
                Text(r).font(.body).fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
