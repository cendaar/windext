import Foundation

/// Profile, followed spots and the last verdicts, shared between the app and the widget through the App Group.
enum SharedStore {
    static let group = "group.br.windext"
    private static var defaults: UserDefaults { UserDefaults(suiteName: group) ?? .standard }

    private static func read<T: Decodable>(_ key: String) -> T? {
        guard let d = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: d)
    }
    private static func write<T: Encodable>(_ value: T, _ key: String) {
        if let d = try? JSONEncoder().encode(value) { defaults.set(d, forKey: key) }
    }

    static var profile: Profile? {
        get { read("profile") }
        set { if let v = newValue { write(v, "profile") } else { defaults.removeObject(forKey: "profile") } }
    }
    static var spots: [Spot] {
        get { read("spots") ?? [] }
        set { write(newValue, "spots") }
    }
    static func cached(_ spotId: String) -> CachedVerdict? { read("verdict.\(spotId)") }
    static func setCached(_ v: CachedVerdict, for spotId: String) { write(v, "verdict.\(spotId)") }
}
