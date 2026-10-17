import Foundation
import Observation
import WidgetKit

@MainActor @Observable
final class AppModel {
    var profile: Profile? { didSet { SharedStore.profile = profile; if oldValue != profile { verdicts = [:]; Task { await refreshAll() } } } }
    var spots: [Spot] { didSet { SharedStore.spots = spots; WidgetCenter.shared.reloadAllTimelines() } }
    var verdicts: [String: VerdictResponse] = [:]
    var loading: Set<String> = []
    var failed: Set<String> = []

    init() {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-windextDemo") {
            SharedStore.profile = Profile(sport: .kitesurf, weightKg: 80, sizes: [9, 12], level: .intermediate)
            SharedStore.spots = [
                Spot(id: "49.2865,-0.2605", name: "Ouistreham", country: "France", lat: 49.2865, lon: -0.2605, serverId: nil, facing: 15),
                Spot(id: "leucate-la-franqui", name: "Leucate La Franqui", country: "France", lat: 42.9382, lon: 3.03858, serverId: "leucate-la-franqui", facing: 100),
                Spot(id: "tarifa-los-lances", name: "Tarifa Los Lances", country: "Spain", lat: 36.0355, lon: -5.62946, serverId: "tarifa-los-lances", facing: 220),
            ]
        }
        #endif
        profile = SharedStore.profile
        spots = SharedStore.spots
        for s in spots { if let c = SharedStore.cached(s.id) { verdicts[s.id] = c.response } }
    }

    func refreshAll() async {
        await withTaskGroup(of: Void.self) { g in for s in spots { g.addTask { await self.refresh(s) } } }
        WidgetCenter.shared.reloadAllTimelines()
    }

    func refresh(_ spot: Spot) async {
        guard let profile else { return }
        loading.insert(spot.id); defer { loading.remove(spot.id) }
        do {
            let v = try await API.verdict(for: spot, profile: profile)
            verdicts[spot.id] = v
            failed.remove(spot.id)
            SharedStore.setCached(CachedVerdict(fetchedAt: .now, response: v), for: spot.id)
            Notifications.scheduleFollowUp(spot: spot, response: v)
        } catch {
            failed.insert(spot.id)
        }
    }

    func add(_ spot: Spot) {
        guard !spots.contains(where: { $0.id == spot.id }) else { return }
        spots.append(spot)
        Task { await refresh(spot) }
    }

    func remove(at offsets: IndexSet) { spots.remove(atOffsets: offsets) }
    func move(from: IndexSet, to: Int) { spots.move(fromOffsets: from, toOffset: to) }
}
