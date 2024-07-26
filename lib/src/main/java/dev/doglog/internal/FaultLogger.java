// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal;

import edu.wpi.first.hal.HALUtil;
import java.util.HashMap;
import java.util.Map;

/** Provides the interface for logging faults. */
public class FaultLogger {
  private static final Map<String, Integer> faultCounts = new HashMap<>();

  public static void logFault(LogQueuer logger, String faultName) {
    faultCounts.merge(faultName, 1, Integer::sum);

    log(logger);
  }

  public static boolean faultsLogged() {
    return !faultCounts.isEmpty();
  }

  private static void log(LogQueuer logger) {
    var now = HALUtil.getFPGATime();

    for (var entry : faultCounts.entrySet()) {
      logger.queueLog(now, "Faults/Counts/" + entry.getKey(), entry.getValue());
    }

    logger.queueLog(now, "Faults/Seen", faultCounts.keySet().toArray(String[]::new));
  }

  private FaultLogger() {}
}
