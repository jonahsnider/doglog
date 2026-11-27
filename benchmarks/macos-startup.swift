import AppKit
import Foundation

struct BenchmarkError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

func hasVisibleWindow(pid: pid_t) -> Bool {
  let windows =
    CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
    as? [[String: Any]] ?? []
  return windows.contains { window in
    guard window[kCGWindowOwnerPID as String] as? pid_t == pid,
      window[kCGWindowLayer as String] as? Int == 0,
      let alpha = window[kCGWindowAlpha as String] as? Double, alpha > 0,
      let bounds = window[kCGWindowBounds as String] as? NSDictionary,
      let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary)
    else { return false }
    return rect.width >= 100 && rect.height >= 100
  }
}

@MainActor
func measureStartup(_ url: URL, id: String) async throws -> Double {
  guard NSRunningApplication.runningApplications(withBundleIdentifier: id).isEmpty else {
    throw BenchmarkError(
      message: "Quit \(url.lastPathComponent) before running the benchmark.")
  }

  let config = NSWorkspace.OpenConfiguration()
  config.activates = false
  config.createsNewApplicationInstance = true
  let clock = ProcessInfo.processInfo
  let start = clock.systemUptime
  let app = try await NSWorkspace.shared.openApplication(at: url, configuration: config)
  var firstWindowMs: Double?
  while clock.systemUptime - start < 30 && !app.isTerminated {
    if hasVisibleWindow(pid: app.processIdentifier) {
      firstWindowMs = (clock.systemUptime - start) * 1000
      break
    }
    try await Task.sleep(for: .milliseconds(20))
  }

  let exitedBeforeWindow = app.isTerminated
  if !app.isTerminated {
    _ = app.terminate()
    let deadline = clock.systemUptime + 5
    while !app.isTerminated && clock.systemUptime < deadline {
      try await Task.sleep(for: .milliseconds(20))
    }
  }
  guard app.isTerminated else {
    throw BenchmarkError(message: "The app did not quit; close it before retrying.")
  }
  guard let firstWindowMs else {
    throw BenchmarkError(
      message: exitedBeforeWindow
        ? "The app quit before showing a window." : "No visible window within 30 seconds.")
  }
  return firstWindowMs
}

guard CommandLine.arguments.count == 3 else {
  fputs("Expected an app bundle path and bundle ID.\n", stderr)
  exit(EXIT_FAILURE)
}

do {
  guard NSScreen.main != nil else {
    throw BenchmarkError(message: "Run the benchmark in a logged-in macOS desktop session.")
  }
  let url = URL(fileURLWithPath: CommandLine.arguments[1])
  print(try await measureStartup(url, id: CommandLine.arguments[2]))
} catch {
  fputs("\(error.localizedDescription)\n", stderr)
  exit(EXIT_FAILURE)
}
