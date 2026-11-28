import AppKit
import ApplicationServices
import Carbon.HIToolbox
import ScreenCaptureKit

struct BenchmarkError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

func uptime() -> Double { ProcessInfo.processInfo.systemUptime }

// Look inside the plot, away from legends, axes, sidebars and the loading bar. Require a
// thin colored trace across many columns, not a solid region, cursor, or progress indicator.
func hasTrace(_ image: CGImage) throws -> Bool {
  let width = image.width
  let height = image.height
  guard
    let context = CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
      space: CGColorSpace(name: CGColorSpace.sRGB)!,
      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ), let pixels = context.data?.assumingMemoryBound(to: UInt8.self)
  else {
    throw BenchmarkError(message: "Could not read the captured window pixels.")
  }
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  func colored(_ x: Int, _ y: Int) -> Bool {
    let offset = (y * width + x) * 4
    let (r, g, b) = (Int(pixels[offset]), Int(pixels[offset + 1]), Int(pixels[offset + 2]))
    return max(r, g, b) - min(r, g, b) >= 50
  }
  let left = width * 3 / 10
  let right = width * 8 / 10
  var columns = 0
  for x in left..<right {
    for y in (height / 5)..<(height * 4 / 5) {
      if colored(x, y) && !colored(x, y - 4) && !colored(x, y + 4) {
        columns += 1
        break
      }
    }
  }
  return columns * 4 >= right - left
}

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
  var value: CFTypeRef?
  return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func find(_ element: AXUIElement, role: String, label: String) -> AXUIElement? {
  if attribute(element, kAXRoleAttribute) as? String == role,
    [kAXDescriptionAttribute, kAXTitleAttribute, kAXValueAttribute].contains(where: {
      attribute(element, $0) as? String == label
    })
  {
    return element
  }
  for child in attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? [] {
    if let match = find(child, role: role, label: label) { return match }
  }
  return nil
}

@MainActor
func waitFor<T>(_ message: String, _ get: () -> T?) async throws -> T {
  let deadline = uptime() + 5
  while uptime() < deadline {
    if let result = get() { return result }
    try await Task.sleep(for: .milliseconds(30))
  }
  throw BenchmarkError(message: message)
}

func key(_ code: CGKeyCode, _ flags: CGEventFlags = [], text: [UInt16] = []) {
  for down in [true, false] {
    let event = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down)
    event?.flags = flags
    if !text.isEmpty {
      event?.keyboardSetUnicodeString(stringLength: text.count, unicodeString: text)
    }
    event?.post(tap: .cghidEventTap)
  }
}

@MainActor
func selectLog(_ log: URL, in app: NSRunningApplication, axApp: AXUIElement) async throws
  -> AXUIElement
{
  _ = app.activate()
  func requireFocus() async throws {
    _ = try await waitFor("The benchmark window is not in front.") {
      let front = NSWorkspace.shared.frontmostApplication?.processIdentifier
      return front == app.processIdentifier ? true : nil
    }
  }
  try await requireFocus()
  key(CGKeyCode(kVK_ANSI_O), .maskCommand)
  let open = try await waitFor("The Open dialog did not appear.") {
    find(axApp, role: kAXButtonRole, label: "Open")
  }
  try await requireFocus()
  key(CGKeyCode(kVK_ANSI_G), [.maskCommand, .maskShift])  // Go to Folder
  func focusedPathField() -> AXUIElement? {
    guard let focused = attribute(axApp, kAXFocusedUIElementAttribute),
      CFGetTypeID(focused) == AXUIElementGetTypeID()
    else { return nil }
    let element = unsafeBitCast(focused, to: AXUIElement.self)
    let role = attribute(element, kAXRoleAttribute) as? String
    return role == kAXTextFieldRole || role == kAXComboBoxRole ? element : nil
  }
  let field = try await waitFor("The Go to Folder field did not appear.", focusedPathField)
  try await requireFocus()
  key(CGKeyCode(kVK_ANSI_A), .maskCommand)
  for scalar in log.path.unicodeScalars { key(0, text: Array(String(scalar).utf16)) }
  _ = try await waitFor("The file picker did not receive the full log path.") {
    attribute(field, kAXValueAttribute) as? String == log.path ? true : nil
  }
  try await requireFocus()
  key(CGKeyCode(kVK_Return))  // Confirm the path, not the Open dialog.
  return try await waitFor("The selected log could not be opened from the file picker.") {
    guard focusedPathField() == nil, attribute(open, kAXEnabledAttribute) as? Bool == true
    else { return nil }
    return open
  }
}

func loadedTimeline(pid: pid_t, start: Double) async throws -> Double {
  let app = AXUIElementCreateApplication(pid)
  AXUIElementSetMessagingTimeout(app, 0.05)
  while uptime() - start < 25 {
    try Task.checkCancellation()
    if find(app, role: kAXButtonRole, label: "Play") != nil { return (uptime() - start) * 1000 }
    try await Task.sleep(for: .milliseconds(40))
  }
  throw BenchmarkError(message: "Studio did not show its loaded timeline within 25 seconds.")
}

@available(macOS 14.2, *)
@MainActor
func measure(_ app: NSRunningApplication, bundle: URL, log: URL, signal: String, studio: Bool)
  async throws -> [String: Double]
{
  let deadline = uptime() + 10
  var window: SCWindow?
  while uptime() < deadline && !app.isTerminated {
    let content = try await SCShareableContent.excludingDesktopWindows(
      true, onScreenWindowsOnly: true)
    let windows = content.windows.filter {
      $0.owningApplication?.processID == app.processIdentifier && $0.windowLayer == 0
        && $0.frame.width >= 640 && $0.frame.height >= 400
    }
    guard windows.count <= 1 else {
      throw BenchmarkError(message: "Leave just one graph window in \(bundle.lastPathComponent).")
    }
    if let candidate = windows.first {
      window = candidate
      break
    }
    try await Task.sleep(for: .milliseconds(100))
  }
  guard let window else {
    throw BenchmarkError(message: "No benchmark window (at least 640 × 400 points) appeared.")
  }

  let axApp = AXUIElementCreateApplication(app.processIdentifier)
  AXUIElementSetMessagingTimeout(axApp, 0.05)
  if !studio {
    _ = AXUIElementSetAttributeValue(axApp, "AXManualAccessibility" as CFString, kCFBooleanTrue)
    _ = try await waitFor("Select a Line Graph with \(signal) in its legend before benchmarking.") {
      let role = kAXStaticTextRole
      return find(axApp, role: role, label: "Left Axis") != nil
        && find(axApp, role: role, label: signal) != nil ? true : nil
    }
  }
  let filter = SCContentFilter(desktopIndependentWindow: window)
  let capture = SCStreamConfiguration()
  capture.width = 640
  capture.height = Int(window.frame.height / window.frame.width * 640)
  capture.showsCursor = false
  capture.ignoreShadowsSingleWindow = true
  func frame() async throws -> CGImage {
    try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: capture)
  }

  // Let the saved graph finish restoring before handing off the file. Nothing is timed yet.
  try await Task.sleep(for: .seconds(1))
  let empty = try await frame()
  guard try !hasTrace(empty), !studio || find(axApp, role: kAXButtonRole, label: "Play") == nil
  else {
    throw BenchmarkError(
      message: "Start with one empty graph and no open log in \(bundle.lastPathComponent).")
  }
  let open = try await selectLog(log, in: app, axApp: axApp)
  let start = uptime()
  guard AXUIElementPerformAction(open, kAXPressAction as CFString) == .success else {
    throw BenchmarkError(message: "Could not confirm the file picker.")
  }
  let pid = app.processIdentifier
  let loaded = studio ? Task.detached { try await loadedTimeline(pid: pid, start: start) } : nil
  defer { loaded?.cancel() }
  _ = try await waitFor("The file picker did not close after confirming the log.") {
    attribute(open, kAXRoleAttribute) == nil ? true : nil
  }

  while uptime() - start < 25 && !app.isTerminated {
    let image = try await frame()
    let captured = uptime()
    if try hasTrace(image) {
      var result = ["openGraphMs": (captured - start) * 1000]
      if let loaded { result["timelineReadyMs"] = try await loaded.value }
      try await Task.sleep(for: .seconds(5))
      result["loadedFootprintBytes"] = try footprintBytes(pid: pid)
      return result
    }
    try await Task.sleep(for: .milliseconds(16))
  }
  throw BenchmarkError(
    message: "No colored data line became visible. Check the saved graph and its binding.")
}

@available(macOS 14.2, *)
@MainActor
func run(bundle: URL, id: String, log: URL, signal: String) async throws -> [String: Double] {
  let studio = id == "studio.doglog"
  guard CGPreflightScreenCaptureAccess() else {
    throw BenchmarkError(
      message: "Grant Screen Recording permission to the terminal running the benchmark.")
  }
  guard AXIsProcessTrusted() else {
    throw BenchmarkError(
      message: "Grant Accessibility permission to the terminal to operate the file picker.")
  }
  guard NSRunningApplication.runningApplications(withBundleIdentifier: id).isEmpty else {
    throw BenchmarkError(message: "Quit \(bundle.lastPathComponent) before running the benchmark.")
  }
  let config = NSWorkspace.OpenConfiguration()
  config.createsNewApplicationInstance = true
  let app = try await NSWorkspace.shared.openApplication(at: bundle, configuration: config)
  let result: Result<[String: Double], Error>
  do {
    result = .success(
      try await measure(app, bundle: bundle, log: log, signal: signal, studio: studio))
  } catch {
    result = .failure(error)
  }
  if !app.isTerminated {
    _ = app.terminate()
    let deadline = uptime() + 5
    while !app.isTerminated && uptime() < deadline {
      try await Task.sleep(for: .milliseconds(50))
    }
  }
  guard app.isTerminated else {
    throw BenchmarkError(
      message: "\(bundle.lastPathComponent) did not quit; close it before retrying.")
  }
  return try result.get()
}

@main
struct OpenGraphProbe {
  static func main() async {
    guard CommandLine.arguments.count == 5 else {
      fputs("Expected an app bundle path, bundle ID, log path, and signal.\n", stderr)
      exit(EXIT_FAILURE)
    }

    do {
      guard #available(macOS 14.2, *), NSScreen.main != nil else {
        throw BenchmarkError(message: "Run in a logged-in macOS 14.2 or newer desktop session.")
      }
      let bundle = URL(fileURLWithPath: CommandLine.arguments[1])
      let log = URL(fileURLWithPath: CommandLine.arguments[3])
      let result = try await run(
        bundle: bundle, id: CommandLine.arguments[2], log: log, signal: CommandLine.arguments[4])
      print(String(decoding: try JSONEncoder().encode(result), as: UTF8.self))
    } catch {
      fputs("\(error.localizedDescription)\n", stderr)
      exit(EXIT_FAILURE)
    }
  }
}
