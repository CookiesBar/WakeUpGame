import ExpoModulesCore
#if canImport(AlarmKit)
import ActivityKit
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

    // openText: a second button that opens the app (after Face ID) straight into the wake-up game.
    AsyncFunction("schedule") { (id: String, epochMs: Double, title: String, stopText: String, sound: String?, rearm: Bool, openText: String?) async throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        try await WakeyAlarmKit.schedule(id: id, epochMs: epochMs, title: title, stopText: stopText, sound: sound,
                                         rearms: rearm ? WakeyAlarmKit.maxRearms : 0, openText: openText)
        return
      }
      #endif
      throw Exception(name: "Unsupported", description: "AlarmKit needs iOS 26")
    }

    // A "Still awake?" link: Yes (the stop button) and No (opens the app). Both end the whole check.
    AsyncFunction("scheduleCheck") { (id: String, epochMs: Double, title: String, yesText: String, noText: String, sound: String?, checkId: String) async throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        try await WakeyAlarmKit.scheduleCheck(id: id, epochMs: epochMs, title: title, yesText: yesText, noText: noText, sound: sound, checkId: checkId)
        return
      }
      #endif
      throw Exception(name: "Unsupported", description: "AlarmKit needs iOS 26")
    }

    // Make alarm `id` part of check `checkId` (its ring-again chain), so a Yes or No on the check ends it too.
    Function("linkToCheck") { (checkId: String, id: String) in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { WakeyAlarmKit.link(checkId, id) }
      #endif
    }

    // Yes / No answers given on the alert since the last call, by check id ("yes" | "no"). Reading clears them.
    Function("takeCheckAnswers") { () -> [String: String] in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return WakeyAlarmKit.takeAnswers() }
      #endif
      return [:]
    }

    // The alarm id whose Play button opened the app since the last call (nil if none). Reading clears it.
    Function("takeOpenRequest") { () -> String? in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return WakeyAlarmKit.takeOpen() }
      #endif
      return nil
    }

    // Ids of the AlarmKit alarms ringing right now (opening the app while one rings starts its game).
    Function("alertingIds") { () -> [String] in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return ((try? AlarmManager.shared.alarms) ?? []).filter { $0.state == .alerting }.map { $0.id.uuidString.lowercased() }
      }
      #endif
      return []
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
  static func schedule(id: String, epochMs: Double, title: String, stopText: String, sound: String?, rearms: Int, openText: String? = nil) async throws {
    guard let uuid = UUID(uuidString: id) else {
      throw Exception(name: "InvalidId", description: "Not a UUID: \(id)")
    }
    // Play dismisses without running the stop (re-arm) intent, so a cancelled Face ID would end the chain.
    // Only the links that have later links behind them get Play; the re-arming last link keeps Stop only.
    let playText = rearms > 0 ? nil : openText
    let alert = AlarmPresentation.Alert(
      title: "\(title)",
      stopButton: AlarmButton(text: "\(stopText)", textColor: .white, systemImageName: "stop.circle"),
      secondaryButton: playText.map { AlarmButton(text: "\($0)", textColor: .white, systemImageName: "figure.walk") },
      secondaryButtonBehavior: playText == nil ? nil : .custom
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
    let openIntent: (any LiveActivityIntent)? = playText.map { _ in WakeyOpenGameIntent(alarmId: id) }
    let configuration = AlarmManager.AlarmConfiguration(
      countdownDuration: nil,
      schedule: .fixed(Date(timeIntervalSince1970: epochMs / 1000)),
      attributes: attributes,
      stopIntent: stopIntent,
      secondaryIntent: openIntent,
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

  // --- "Still awake?" ---
  static let answersKey = "WakeyAlarm.checkAnswers"
  static func linksKey(_ checkId: String) -> String { "WakeyAlarm.check:\(checkId)" }

  static func scheduleCheck(id: String, epochMs: Double, title: String, yesText: String, noText: String, sound: String?, checkId: String) async throws {
    guard let uuid = UUID(uuidString: id) else {
      throw Exception(name: "InvalidId", description: "Not a UUID: \(id)")
    }
    let alert = AlarmPresentation.Alert(
      title: "\(title)",
      stopButton: AlarmButton(text: "\(yesText)", textColor: .white, systemImageName: "checkmark.circle"),
      secondaryButton: AlarmButton(text: "\(noText)", textColor: .white, systemImageName: "moon.zzz"),
      secondaryButtonBehavior: .custom
    )
    let attributes = AlarmAttributes<WakeyAlarmMetadata>(
      presentation: AlarmPresentation(alert: alert),
      metadata: WakeyAlarmMetadata(),
      tintColor: Color(red: 0.157, green: 0.408, blue: 0.878) // Wakey blue #2868E0
    )
    let alertSound: AlertConfiguration.AlertSound = sound.map { .named($0) } ?? .default
    let configuration = AlarmManager.AlarmConfiguration(
      countdownDuration: nil,
      schedule: .fixed(Date(timeIntervalSince1970: epochMs / 1000)),
      attributes: attributes,
      stopIntent: WakeyCheckYesIntent(checkId: checkId),
      secondaryIntent: WakeyCheckNoIntent(checkId: checkId),
      sound: alertSound
    )
    cancel(id: id)
    _ = try await AlarmManager.shared.schedule(id: uuid, configuration: configuration)
    // Remember the check's links, so one answer ends them all; a new check forgets an unread old answer.
    link(checkId, id)
    answersLock.lock()
    var answers = UserDefaults.standard.dictionary(forKey: answersKey) as? [String: String] ?? [:]
    answers.removeValue(forKey: checkId)
    UserDefaults.standard.set(answers, forKey: answersKey)
    answersLock.unlock()
  }

  static func link(_ checkId: String, _ id: String) {
    var links = UserDefaults.standard.stringArray(forKey: linksKey(checkId)) ?? []
    if !links.contains(id) { links.append(id) }
    UserDefaults.standard.set(links, forKey: linksKey(checkId))
  }

  // Store the answer for JS and silence the whole check (the link ringing now and the ones still to come).
  // The intent writes an answer while JS may be reading them: both go through this lock.
  static let answersLock = NSLock()

  static func answer(_ checkId: String, _ value: String) {
    answersLock.lock()
    var answers = UserDefaults.standard.dictionary(forKey: answersKey) as? [String: String] ?? [:]
    answers[checkId] = value
    UserDefaults.standard.set(answers, forKey: answersKey)
    answersLock.unlock()
    for id in UserDefaults.standard.stringArray(forKey: linksKey(checkId)) ?? [] {
      if let uuid = UUID(uuidString: id) { try? AlarmManager.shared.stop(id: uuid) }
      cancel(id: id)
    }
    UserDefaults.standard.removeObject(forKey: linksKey(checkId))
  }

  static func takeAnswers() -> [String: String] {
    answersLock.lock()
    defer { answersLock.unlock() }
    let answers = UserDefaults.standard.dictionary(forKey: answersKey) as? [String: String] ?? [:]
    UserDefaults.standard.removeObject(forKey: answersKey)
    return answers
  }

  static let openKey = "WakeyAlarm.open"
  static let openAtKey = "WakeyAlarm.openAt"
  static let openTTL: TimeInterval = 5 * 60 // a Play older than this is stale: never start a game hours later
  static func takeOpen() -> String? {
    let id = UserDefaults.standard.string(forKey: openKey)
    let at = UserDefaults.standard.double(forKey: openAtKey)
    UserDefaults.standard.removeObject(forKey: openKey)
    UserDefaults.standard.removeObject(forKey: openAtKey)
    return Date().timeIntervalSince1970 - at < openTTL ? id : nil
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

// Play on a ringing alarm: unlock, open the app, and JS starts the wake-up game for this alarm.
// The chain's next links stay armed until the game's first step cancels them, so Play can't dodge the alarm.
@available(iOS 26.0, *)
public struct WakeyOpenGameIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Play the wake-up game"
  public static var openAppWhenRun: Bool = true

  @Parameter(title: "alarmId") public var alarmId: String

  public init() {}

  init(alarmId: String) {
    self.alarmId = alarmId
  }

  public func perform() async throws -> some IntentResult {
    UserDefaults.standard.set(alarmId, forKey: WakeyAlarmKit.openKey)
    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: WakeyAlarmKit.openAtKey)
    return .result()
  }
}

// "Still awake?" → Yes (the alert's stop button): awake. Ends the check without opening the app.
@available(iOS 26.0, *)
public struct WakeyCheckYesIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "I'm awake"
  public static var openAppWhenRun: Bool = false

  @Parameter(title: "checkId") public var checkId: String

  public init() {}

  init(checkId: String) {
    self.checkId = checkId
  }

  public func perform() async throws -> some IntentResult {
    WakeyAlarmKit.answer(checkId, "yes")
    return .result()
  }
}

// "Still awake?" → No: ends the check and opens the app, where JS starts the wake-up game again.
@available(iOS 26.0, *)
public struct WakeyCheckNoIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Not awake yet"
  public static var openAppWhenRun: Bool = true

  @Parameter(title: "checkId") public var checkId: String

  public init() {}

  init(checkId: String) {
    self.checkId = checkId
  }

  public func perform() async throws -> some IntentResult {
    WakeyAlarmKit.answer(checkId, "no")
    return .result()
  }
}
#endif
