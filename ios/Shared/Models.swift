import Foundation

// MARK: - Rider profile (stored on the device only, never on the server)

enum Sport: String, Codable, CaseIterable, Sendable, Identifiable {
    case kitesurf, wingfoil, windsurf
    var id: String { rawValue }
    var unit: String { self == .windsurf ? "m²" : "m" }
    /// Sizes most riders own, offered as quick picks in onboarding.
    var commonSizes: [Double] {
        switch self {
        case .kitesurf: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17]
        case .wingfoil: [2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7]
        case .windsurf: [3.7, 4.2, 4.7, 5.3, 5.8, 6.5, 7.3, 7.8, 8.5]
        }
    }
    var defaultSizes: [Double] {
        switch self {
        case .kitesurf: [9, 12]
        case .wingfoil: [4, 5.5]
        case .windsurf: [4.7, 5.8]
        }
    }
}

enum Level: String, Codable, CaseIterable, Sendable, Identifiable {
    case beginner, intermediate, expert
    var id: String { rawValue }
}

struct Profile: Codable, Equatable, Sendable {
    var sport: Sport = .kitesurf
    var weightKg: Int = 75
    var sizes: [Double] = Sport.kitesurf.defaultSizes
    var level: Level = .intermediate
}

// MARK: - Spots the rider follows

struct Spot: Codable, Identifiable, Hashable, Sendable {
    /// Server spot id when the spot is in the windext database, otherwise "lat,lon".
    var id: String
    var name: String
    var country: String
    var lat: Double
    var lon: Double
    var serverId: String?
    var facing: Double?
}

// MARK: - API payloads (mirror of /v1/verdict and /v1/spots)

struct VerdictResponse: Codable, Sendable {
    struct Day: Codable, Sendable, Hashable {
        struct Window: Codable, Sendable, Hashable { let start: String; let end: String }
        struct Gear: Codable, Sendable, Hashable { let size: Double; let unit: String }
        struct Wind: Codable, Sendable, Hashable { let speed: Double; let gust: Double; let dir: String }
        let day: String
        let date: String
        let status: String          // go | check | no
        let headline: String
        let reasons: [String]
        let window: Window?
        let gear: Gear?
        let wind: Wind?
        let confidence: String
        let score: Int
    }
    let issued: String
    let timezone: String
    let days: [Day]
    let alerts: [String]?
}

struct SpotSearchResponse: Codable, Sendable {
    struct Known: Codable, Sendable, Hashable { let id: String; let name: String; let country: String; let lat: Double; let lon: Double; let status: String; let facing_deg: Double? }
    struct Place: Codable, Sendable, Hashable { let name: String; let admin: String; let country: String; let lat: Double; let lon: Double }
    let spots: [Known]
    let places: [Place]
}

/// What the app keeps per spot so the list and the widget open instantly, even offline.
struct CachedVerdict: Codable, Sendable {
    let fetchedAt: Date
    let response: VerdictResponse
}
