package dev.doglog.internal;

import dev.doglog.internal.writers.LogWriterHighLevel;
import java.util.HashMap;
import java.util.Map;

public class EpochLogger {
  private final Map<String, Long> epochMap = new HashMap<>();

  public void time(String key, long timestamp) {
    epochMap.put(key, timestamp);
  }

  public void timeEnd(String key, long timestamp, LogWriterHighLevel logger) {
    var previous = epochMap.get(key);
    if (previous != null) {
      // Get the difference between previous and current timestamps in microseconds
      // Divide by 1e6 to convert to seconds
      logger.log(timestamp, key, (timestamp - previous) / 1e6);
      epochMap.remove(key);
    }
  }
}
