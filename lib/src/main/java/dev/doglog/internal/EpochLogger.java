package dev.doglog.internal;

import com.google.errorprone.annotations.ThreadSafe;
import dev.doglog.DogLog;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@ThreadSafe
public class EpochLogger {
  private final Map<String, Long> epochMap = new ConcurrentHashMap<>();

  public void time(String key, long timestamp) {
    epochMap.put(key, timestamp);
  }

  public void timeEnd(String key, long timestamp) {
    var previous = epochMap.get(key);
    if (previous != null) {
      // Monotonic timestamps are in nanoseconds.
      DogLog.log(key, (timestamp - previous) / 1e9);
      epochMap.remove(key);
    }
  }
}
