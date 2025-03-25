// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal;

import java.util.HashMap;
import java.util.Map;

public class EpochLogger {
  private final Map<String, Long> epochMap = new HashMap<>();
  private final LogQueuer logger;

  public EpochLogger(LogQueuer logger) {
    this.logger = logger;
  }

  public void time(String key, long timestamp) {
    epochMap.put(key, timestamp);
  }

  public void timeEnd(String key, long timestamp) {
    var previous = epochMap.get(key);
    if (previous != null) {
      // Get the difference between previous and current timestamps in microseconds
      // Divide by 1e6 to convert to seconds
      logger.queueLog(timestamp, key, (timestamp - previous) / 1e6);
      epochMap.remove(key);
    }
  }
}
