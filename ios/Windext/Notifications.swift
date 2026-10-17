import Foundation
import UserNotifications

/// After a day windext called worth riding, one evening question: how was it? Three buttons, one tap, anonymous.
/// This is what lets windext learn which model is right at which spot.
enum Notifications {
    static let category = "SESSION_REPORT"

    static func requestPermission() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
    }

    static func registerCategory() {
        let actions = [
            UNNotificationAction(identifier: API.Feeling.underpowered.rawValue, title: String(localized: "Underpowered")),
            UNNotificationAction(identifier: API.Feeling.ok.rawValue, title: String(localized: "Just right")),
            UNNotificationAction(identifier: API.Feeling.overpowered.rawValue, title: String(localized: "Overpowered")),
            UNNotificationAction(identifier: API.Feeling.skipped.rawValue, title: String(localized: "I didn't go")),
        ]
        UNUserNotificationCenter.current().setNotificationCategories([UNNotificationCategory(identifier: category, actions: actions, intentIdentifiers: [])])
    }

    /// One reminder per spot and day: an hour after the window ends, only for go or maybe days.
    static func scheduleFollowUp(spot: Spot, response: VerdictResponse) {
        let center = UNUserNotificationCenter.current()
        for day in response.days where day.status != "no" {
            guard let window = day.window, let fire = date(day.date, window.end, plusMinutes: 60, timezone: response.timezone), fire > .now else { continue }
            let content = UNMutableNotificationContent()
            content.title = spot.name
            content.body = String(localized: "Did you ride? Tell windext how it was, it helps the next rider.")
            content.categoryIdentifier = category
            content.userInfo = ["spot": (try? JSONEncoder().encode(spot)).map { String(decoding: $0, as: UTF8.self) } ?? "", "day": day.date, "predicted": "\(day.status) \(day.score)", "gear": day.gear?.size ?? 0]
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fire)
            let req = UNNotificationRequest(identifier: "report.\(spot.id).\(day.date)", content: content, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false))
            center.add(req)
        }
    }

    static func handle(action: String, userInfo: [AnyHashable: Any]) async {
        guard let feeling = API.Feeling(rawValue: action), let raw = userInfo["spot"] as? String, let spot = try? JSONDecoder().decode(Spot.self, from: Data(raw.utf8)), let profile = SharedStore.profile, let day = userInfo["day"] as? String else { return }
        let gear = (userInfo["gear"] as? Double).flatMap { $0 > 0 ? $0 : nil }
        try? await API.report(spot: spot, day: day, feeling: feeling, profile: profile, gear: gear, predicted: userInfo["predicted"] as? String ?? "")
    }

    private static func date(_ day: String, _ hm: String, plusMinutes: Int, timezone: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: timezone)
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f.date(from: "\(day) \(hm)")?.addingTimeInterval(TimeInterval(plusMinutes * 60))
    }
}
