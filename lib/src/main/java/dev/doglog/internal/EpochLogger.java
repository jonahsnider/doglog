package dev.doglog.internal;

import com.google.errorprone.annotations.ThreadSafe;
import dev.doglog.internal.writers.LogWriter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@ThreadSafe
public class EpochLogger {
  private final Map<String, Long> epochMap = new ConcurrentHashMap<>();

  public void time(String key, long timestamp) {
    epochMap.put(key, timestamp);
  }

  public void timeEnd(String key, long timestamp, LogWriter logger) {
    var previous = epochMap.get(key);
    if (previous != null) {
      // Get the difference between previous and current timestamps in microseconds
      // Divide by 1e6 to convert to seconds
      logger.log(timestamp, key, (timestamp - previous) / 1e6);
      epochMap.remove(key);
    }
  }
}
