import Foundation

/// Client for the windext JSON API. Stateless; the rider profile travels in the query and is never stored server-side.
enum API {
    static let base = URL(string: "https://wind.oooooooo.dev")!

    /// Language of the verdict text: the device language when the server speaks it, English otherwise.
    static var lang: String {
        let code = Locale.current.language.languageCode?.identifier ?? "en"
        return ["en", "fr", "de", "es", "pt", "it", "nl"].contains(code) ? code : "en"
    }

    static func verdict(for spot: Spot, profile: Profile) async throws -> VerdictResponse {
        var c = URLComponents(url: base.appending(path: "v1/verdict"), resolvingAgainstBaseURL: false)!
        var q: [URLQueryItem] = [
            .init(name: "sport", value: profile.sport.rawValue),
            .init(name: "weight", value: String(profile.weightKg)),
            .init(name: "sizes", value: profile.sizes.map { $0.formatted(.number.locale(Locale(identifier: "en_US_POSIX"))) }.joined(separator: ",")),
            .init(name: "level", value: profile.level.rawValue),
            .init(name: "lang", value: lang),
        ]
        // Always send the coordinates: the server uses them when the spot id is unknown or was renamed
        if let id = spot.serverId { q.append(.init(name: "spot", value: id)) }
        q.append(.init(name: "lat", value: String(spot.lat)))
        q.append(.init(name: "lon", value: String(spot.lon)))
        if spot.serverId == nil, let f = spot.facing { q.append(.init(name: "facing", value: String(f))) }
        c.queryItems = q
        return try await get(c.url!)
    }

    static func search(_ text: String) async throws -> SpotSearchResponse {
        var c = URLComponents(url: base.appending(path: "v1/spots"), resolvingAgainstBaseURL: false)!
        c.queryItems = [.init(name: "q", value: text)]
        return try await get(c.url!)
    }

    enum Feeling: String, Sendable { case underpowered, ok, overpowered, skipped, no_wind }

    /// Anonymous session report: a fact about a spot on a day, no identifier of any kind.
    static func report(spot: Spot, day: String, feeling: Feeling, profile: Profile, gear: Double?, predicted: String) async throws {
        var req = URLRequest(url: base.appending(path: "v1/report"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = ["day": day, "feeling": feeling.rawValue, "sport": profile.sport.rawValue, "weight": profile.weightKg, "predicted": predicted, "lat": spot.lat, "lon": spot.lon]
        if let id = spot.serverId { body["spot_id"] = id }
        if let g = gear { body["gear"] = String(g) }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, res) = try await URLSession.shared.data(for: req)
        guard (res as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
    }

    /// GET with one retry: the weather service sometimes refuses a burst of parallel requests.
    private static func get<T: Decodable>(_ url: URL, attempt: Int = 0) async throws -> T {
        var req = URLRequest(url: url)
        req.timeoutInterval = 20
        do {
            let (data, res) = try await URLSession.shared.data(for: req)
            guard let http = res as? HTTPURLResponse, http.statusCode == 200 else { throw URLError(.badServerResponse) }
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            guard attempt == 0, !(error is CancellationError) else { throw error }
            try await Task.sleep(for: .milliseconds(1200))
            return try await get(url, attempt: 1)
        }
    }
}
