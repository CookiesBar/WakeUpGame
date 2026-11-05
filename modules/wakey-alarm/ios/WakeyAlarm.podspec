Pod::Spec.new do |s|
  s.name           = 'WakeyAlarm'
  s.version        = '1.0.0'
  s.summary        = 'AlarmKit bridge for Wakey'
  s.description    = 'Schedules and cancels iOS 26 AlarmKit alarms for Wakey'
  s.license        = 'MIT'
  s.author         = 'TRAN NGUYEN KHOA'
  s.homepage       = 'https://github.com/expo/expo'
  # The app still supports older iOS: AlarmKit is weak-linked and every use is behind `#available(iOS 26.0, *)`.
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'AlarmKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
