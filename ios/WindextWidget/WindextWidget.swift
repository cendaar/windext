import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Choosing the spot

struct SpotEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Spot"
    static let defaultQuery = SpotQuery()
    let id: String
    let name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct SpotQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [SpotEntity] { SharedStore.spots.filter { identifiers.contains($0.id) }.map { SpotEntity(id: $0.id, name: $0.name) } }
    func suggestedEntities() async throws -> [SpotEntity] { SharedStore.spots.map { SpotEntity(id: $0.id, name: $0.name) } }
    func defaultResult() async -> SpotEntity? { SharedStore.spots.first.map { SpotEntity(id: $0.id, name: $0.name) } }
}

struct SelectSpotIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Spot"
    static let description = IntentDescription("Choose the spot this widget follows.")
    @Parameter(title: "Spot") var spot: SpotEntity?
}

// MARK: - Timeline

struct VerdictEntry: TimelineEntry {
    let date: Date
    let spotName: String
    let days: [VerdictResponse.Day]
    let placeholder: Bool
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> VerdictEntry { .sample }
    func snapshot(for configuration: SelectSpotIntent, in context: Context) async -> VerdictEntry { await entry(for: configuration) ?? .sample }
    func timeline(for configuration: SelectSpotIntent, in context: Context) async -> Timeline<VerdictEntry> {
        let e = await entry(for: configuration) ?? VerdictEntry(date: .now, spotName: String(localized: "Add a spot in windext"), days: [], placeholder: false)
        return Timeline(entries: [e], policy: .after(.now.addingTimeInterval(60 * 60)))
    }

    private func entry(for configuration: SelectSpotIntent) async -> VerdictEntry? {
        let spots = SharedStore.spots
        guard let spot = spots.first(where: { $0.id == configuration.spot?.id }) ?? spots.first else { return nil }
        if let profile = SharedStore.profile, let fresh = try? await API.verdict(for: spot, profile: profile) {
            SharedStore.setCached(CachedVerdict(fetchedAt: .now, response: fresh), for: spot.id)
            return VerdictEntry(date: .now, spotName: spot.name, days: fresh.days, placeholder: false)
        }
        if let cached = SharedStore.cached(spot.id) { return VerdictEntry(date: .now, spotName: spot.name, days: cached.response.days, placeholder: false) }
        return VerdictEntry(date: .now, spotName: spot.name, days: [], placeholder: false)
    }
}

extension VerdictEntry {
    static let sample = VerdictEntry(date: .now, spotName: "Leucate", days: [
        .init(day: "Today", date: "", status: "go", headline: "Yes, go from 11:00 to 17:00 with the 9 m.", reasons: [], window: .init(start: "11:00", end: "17:00"), gear: .init(size: 9, unit: "m"), wind: nil, confidence: "high", score: 8),
        .init(day: "Tomorrow", date: "", status: "check", headline: "Maybe, 10:00 to 13:00 with the 12 m.", reasons: [], window: .init(start: "10:00", end: "13:00"), gear: .init(size: 12, unit: "m"), wind: nil, confidence: "low", score: 4),
    ], placeholder: true)
}

// MARK: - Views

struct WidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: VerdictEntry

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        case .systemMedium: medium
        default: small
        }
    }

    private var today: VerdictResponse.Day? { entry.days.first }
    private var tomorrow: VerdictResponse.Day? { entry.days.dropFirst().first }

    /// The windext score, big. One number for today, a small one for tomorrow.
    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(entry.spotName).font(.system(.footnote, design: .serif).weight(.semibold)).lineLimit(1)
            Spacer(minLength: 0)
            if let t = today {
                HStack(alignment: .lastTextBaseline, spacing: 2) {
                    Text("\(t.score)").font(.system(size: 64, weight: .bold, design: .serif)).monospacedDigit().minimumScaleFactor(0.6)
                    Text("/10").font(.system(.footnote, design: .serif)).foregroundStyle(.secondary)
                }
                Text(t.window.map { "\($0.start)–\($0.end)" } ?? t.day).font(.system(.caption, design: .serif)).lineLimit(1)
            } else {
                Text("–").font(.system(size: 64, weight: .bold, design: .serif))
            }
            Spacer(minLength: 0)
            if let m = tomorrow {
                HStack { Text(m.day); Spacer(); Text("\(m.score)").monospacedDigit().fontWeight(.bold) }.font(.system(.caption, design: .serif))
            }
        }
        .redacted(reason: entry.placeholder ? .placeholder : [])
    }

    private var medium: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.spotName).font(.system(.footnote, design: .serif).weight(.semibold)).lineLimit(1)
            ForEach([today, tomorrow].compactMap { $0 }, id: \.date) { d in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(d.score)").font(.system(size: 30, weight: .bold, design: .serif)).monospacedDigit().frame(width: 40, alignment: .leading)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(d.day).font(.system(.caption2, design: .serif)).textCase(.uppercase).foregroundStyle(.secondary)
                        Text(d.headline).font(.system(.caption, design: .serif)).lineLimit(2)
                    }
                }
            }
            if entry.days.isEmpty { Text("Open windext to add a spot.").font(.system(.caption, design: .serif)) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .redacted(reason: entry.placeholder ? .placeholder : [])
    }

    private var circular: some View {
        VStack(spacing: -2) {
            Text(today.map { "\($0.score)" } ?? "–").font(.system(size: 26, weight: .bold, design: .serif))
            Text(today?.window?.start ?? "").font(.system(size: 9))
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading) {
            Text("\(entry.spotName) · \(today.map { "\($0.score)/10" } ?? "–")").font(.headline).lineLimit(1)
            Text(today?.headline ?? "").font(.caption).lineLimit(2)
        }
    }
}

struct WindextWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "windext.verdict", intent: SelectSpotIntent.self, provider: Provider()) { entry in
            WidgetView(entry: entry).containerBackground(Color(.systemBackground), for: .widget)
        }
        .configurationDisplayName("windext")
        .description("Is it worth going today and tomorrow, at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

@main
struct WindextWidgets: WidgetBundle {
    var body: some Widget { WindextWidget() }
}
