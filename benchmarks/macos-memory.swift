import Foundation

private func toolOutput(_ path: String, _ arguments: [String]) throws -> String {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: path)
  process.arguments = arguments
  let pipe = Pipe()
  process.standardOutput = pipe
  try process.run()
  let data = pipe.fileHandleForReading.readDataToEndOfFile()
  process.waitUntilExit()
  guard process.terminationStatus == 0 else {
    throw BenchmarkError(message: "\(path) exited with status \(process.terminationStatus).")
  }
  return String(decoding: data, as: UTF8.self)
}

func footprintBytes(pid: pid_t) throws -> Double {
  // Launch Services attributes WebKit XPC processes to the app even though launchd is their parent.
  let apps = try toolOutput("/usr/bin/lsappinfo", ["list"])
  let lines = apps.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
  guard let app = lines.firstIndex(where: { $0.hasPrefix("pid = \(pid) ") }),
    app + 1 < lines.count, lines[app + 1].hasPrefix("coalition:"),
    let start = lines[app + 1].firstIndex(of: "{"), let end = lines[app + 1].firstIndex(of: "}")
  else {
    throw BenchmarkError(message: "Could not identify the macOS memory coalition for PID \(pid).")
  }
  let pids = lines[app + 1][lines[app + 1].index(after: start)..<end].split(separator: " ").map(
    String.init)
  guard pids.contains(String(pid)) else {
    throw BenchmarkError(message: "The macOS memory coalition does not contain PID \(pid).")
  }
  let output = try toolOutput("/usr/bin/footprint", ["--noCategories", "-f", "bytes"] + pids)
  let totals = output.split(separator: "\n").compactMap { line -> Double? in
    guard let range = line.range(of: "Footprint: ") else { return nil }
    return line[range.upperBound...].split(separator: " ").first.flatMap { Double($0) }
  }
  guard totals.count == pids.count + (pids.count > 1 ? 1 : 0), let bytes = totals.last, bytes > 0
  else {
    throw BenchmarkError(message: "Could not measure every process in the macOS memory coalition.")
  }
  return bytes
}
