import ExpoModulesCore
#if canImport(AlarmKit)
import AlarmKit
import AppIntents
import SwiftUI
#endif

// Thin AlarmKit bridge: alarms that ring through Silent and Focus (iOS 26+).
// Everything else (which alarms, when, the wake-up game) stays in JS.
public class WakeyAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WakeyAlarm")

    Function("isSupported") { () -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return true }
      #endif
      return false
    }

    Function("authorizationState") { () -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return WakeyAlarmKit.state() }
      #endif
      return "unsupported"
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return try await WakeyAlarmKit.request() }
      #endif
      return "unsupported"
    }

    AsyncFunction("schedule") { (id: String, epochMs: Double, title: String, stopText: String, sound: String?, rearm: Bool) async throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        try await WakeyAlarmKit.schedule(id: id, epochMs: epochMs, title: title, stopText: stopText, sound: sound,
                                         rearms: rearm ? WakeyAlarmKit.maxRearms : 0)
        return
      }
      #endif
      throw Exception(name: "Unsupported", description: "AlarmKit needs iOS 26")
    }

    Function("cancel") { (id: String) in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { WakeyAlarmKit.cancel(id: id) }
      #endif
    }

    // Silence whatever is ringing right now (the in-app ring screen takes over).
    Function("stopAlerting") { () in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { WakeyAlarmKit.stopAlerting() }
      #endif
    }
  }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct WakeyAlarmMetadata: AlarmMetadata {}

@available(iOS 26.0, *)
enum WakeyAlarmKit {
  static func state() -> String {
    switch AlarmManager.shared.authorizationState {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "denied"
    }
  }

  static func request() async throws -> String {
    if AlarmManager.shared.authorizationState == .notDetermined {
      _ = try await AlarmManager.shared.requestAuthorization()
    }
    return state()
  }

  // Stop on a re-arming alarm rings it again a minute later, at most this many times
  // (a safety net if the app never gets to cancel it: ~30 min of no-snooze).
  static let maxRearms = 30
  static let rearmDelay: TimeInterval = 60
  static func rearmKey(_ id: String) -> String { "WakeyAlarm.rearm:\(id)" }

  // rearms > 0: Stop runs WakeyRearmIntent, which schedules this id again.
  static func schedule(id: String, epochMs: Double, title: String, stopText: String, sound: String?, rearms: Int) async throws {
    guard let uuid = UUID(uuidString: id) else {
      throw Exception(name: "InvalidId", description: "Not a UUID: \(id)")
    }
    let alert = AlarmPresentation.Alert(
      title: "\(title)",
      stopButton: AlarmButton(text: "\(stopText)", textColor: .white, systemImageName: "stop.circle"),
      secondaryButton: nil,
      secondaryButtonBehavior: nil
    )
    let attributes = AlarmAttributes<WakeyAlarmMetadata>(
      presentation: AlarmPresentation(alert: alert),
      metadata: WakeyAlarmMetadata(),
      tintColor: Color(red: 0.157, green: 0.408, blue: 0.878) // Wakey blue #2868E0
    )
    let alertSound: AlertConfiguration.AlertSound = sound.map { .named($0) } ?? .default
    let stopIntent: (any LiveActivityIntent)? = rearms > 0
      ? WakeyRearmIntent(alarmId: id, title: title, stopText: stopText, sound: sound)
      : nil
    let configuration = AlarmManager.AlarmConfiguration(
      countdownDuration: nil,
      schedule: .fixed(Date(timeIntervalSince1970: epochMs / 1000)),
      attributes: attributes,
      stopIntent: stopIntent,
      secondaryIntent: nil,
      sound: alertSound
    )
    cancel(id: id) // re-scheduling the same id replaces it
    _ = try await AlarmManager.shared.schedule(id: uuid, configuration: configuration)
    if rearms > 0 { UserDefaults.standard.set(rearms, forKey: rearmKey(id)) }
  }

  // AlarmKit throws for unknown ids; a missing alarm is already "cancelled".
  static func cancel(id: String) {
    UserDefaults.standard.removeObject(forKey: rearmKey(id)) // the game took over: stop re-arming
    guard let uuid = UUID(uuidString: id) else { return }
    try? AlarmManager.shared.cancel(id: uuid)
  }

  static func stopAlerting() {
    guard let alarms = try? AlarmManager.shared.alarms else { return }
    for alarm in alarms where alarm.state == .alerting {
      try? AlarmManager.shared.stop(id: alarm.id)
    }
  }
}

// Runs when Stop is tapped on a re-arming alarm: ring again a minute later,
// unless JS cancelled the chain (wake-up game started) in the meantime.
@available(iOS 26.0, *)
public struct WakeyRearmIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Stop alarm"
  public static var openAppWhenRun: Bool = false

  @Parameter(title: "alarmId") public var alarmId: String
  @Parameter(title: "title") public var alarmTitle: String
  @Parameter(title: "stopText") public var stopText: String
  @Parameter(title: "sound") public var sound: String?

  public init() {}

  init(alarmId: String, title: String, stopText: String, sound: String?) {
    self.alarmId = alarmId
    self.alarmTitle = title
    self.stopText = stopText
    self.sound = sound
  }

  public func perform() async throws -> some IntentResult {
    let left = UserDefaults.standard.integer(forKey: WakeyAlarmKit.rearmKey(alarmId)) // 0 if cancelled
    guard left > 1 else {
      UserDefaults.standard.removeObject(forKey: WakeyAlarmKit.rearmKey(alarmId))
      return .result()
    }
    try await WakeyAlarmKit.schedule(
      id: alarmId,
      epochMs: (Date().timeIntervalSince1970 + WakeyAlarmKit.rearmDelay) * 1000,
      title: alarmTitle, stopText: stopText, sound: sound,
      rearms: left - 1
    )
    return .result()
  }
}
#endif
