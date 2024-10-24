// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal;

import edu.wpi.first.hal.HALUtil;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/** Provides the interface for logging faults. */
public class FaultLogger {
  private static final Map<String, Integer> faultCounts = new HashMap<>();
  private static String[] faultNames = new String[] {};

  // This function doesn't need to have the LogQueuer parameter, it could just call DogLog directly.
  // But doing that would mean getting the current time twice, which can be avoided by getting the
  // time once here and reusing that value.
  public static void logFault(LogQueuer logger, String faultName) {
    var previousCount = faultCounts.get(faultName);
    var newCount = previousCount == null ? 1 : previousCount + 1;
    faultCounts.put(faultName, newCount);

    var now = HALUtil.getFPGATime();

    if (previousCount == null) {
      // A new fault has been seen
      faultNames = Arrays.copyOf(faultNames, faultNames.length + 1);
      faultNames[faultNames.length - 1] = faultName;
      logger.queueLog(now, "Faults/Seen", faultNames);
    }
    logger.queueLog(now, "Faults/Counts/" + faultName, newCount);
  }

  public static boolean faultsLogged() {
    return !faultCounts.isEmpty();
  }

  private FaultLogger() {}
}
