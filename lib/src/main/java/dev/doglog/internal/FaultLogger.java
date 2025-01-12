// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal;

import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.wpilibj.Alert;
import edu.wpi.first.wpilibj.Alert.AlertType;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Provides the interface for logging faults. Faults are a DogLog concept that were created prior to
 * WPILib alerts. Alerts are great but are NT only, so faults allow DogLog to provide a simple
 * interface to logging errors that writes to both NT and DataLog.
 */
public class FaultLogger {
  private static final Map<String, Integer> faultCounts = new HashMap<>();
  private static final Map<String, Alert> faultAlerts = new HashMap<>();

  /** Faults that are currently active. */
  private static final Set<String> activeFaults = new HashSet<>();

  // This function doesn't need to have the LogQueuer parameter, it could just call DogLog directly.
  // But doing that would mean getting the current time twice, which can be avoided by getting the
  // time once here and reusing that value.
  public static void addFault(LogQueuer logger, String faultName) {
    var previousCount = faultCounts.get(faultName);
    var newCount = previousCount == null ? 1 : previousCount + 1;
    faultCounts.put(faultName, newCount);

    var now = HALUtil.getFPGATime();

    if (previousCount == null) {
      // A new fault has been seen
      logger.queueLog(now, "Faults/Seen", faultCounts.keySet().toArray(String[]::new));
    }
    if (previousCount == null || previousCount == 0) {
      // Fault has just become active
      activeFaults.add(faultName);
      logger.queueLog(now, "Faults/Active", activeFaults.toArray(String[]::new));
    }
    logger.queueLog(now, "Faults/Counts/" + faultName, newCount);
  }

  /**
   * @param logger LogQueuer to use.
   * @param faultName The name of the fault to log.
   * @param alertType The type of alert to create for the fault, or <code>null</code> if it should
   *     not create an alert
   */
  public static void addFault(LogQueuer logger, String faultName, AlertType alertType) {
    addFault(logger, faultName);
    if (alertType != null) {
      faultAlerts.computeIfAbsent(faultName, k -> new Alert(faultName, alertType)).set(true);
    }
  }

  /**
   * Remove the alert associated with a fault.
   *
   * @param logger LogQueuer to use.
   * @param faultName The name of the fault to remove.
   */
  public static void decreaseFault(LogQueuer logger, String faultName) {
    var previousCount = faultCounts.get(faultName);
    if (previousCount == null || previousCount == 0) {
      // This fault has never occurred
      return;
    }
    var newCount = previousCount - 1;
    faultCounts.put(faultName, newCount);

    var now = HALUtil.getFPGATime();
    logger.queueLog(now, "Faults/Counts/" + faultName, newCount);

    if (newCount == 0) {
      // Mark alert as inactive if it exists
      var alert = faultAlerts.get(faultName);

      if (alert != null) {
        alert.set(false);
      }

      activeFaults.remove(faultName);
      logger.queueLog(now, "Faults/Active", activeFaults.toArray(String[]::new));
    }
  }

  public static void clearFault(LogQueuer logger, String faultName) {
    // The faultCounts map is used to track the seen faults, so we need to make sure that clearing a
    // fault which has never occurred doesn't mark it as seen with a count of 0
    var previousValue = faultCounts.replace(faultName, 0);

    if (previousValue != null) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, "Faults/Counts/" + faultName, 0);

      var alert = faultAlerts.get(faultName);
      if (alert != null) {
        alert.set(false);
      }

      activeFaults.remove(faultName);
      logger.queueLog(now, "Faults/Active", activeFaults.toArray(String[]::new));
    }
  }

  public static boolean faultsLogged() {
    return !faultCounts.isEmpty();
  }

  public static boolean faultsActive() {
    return !activeFaults.isEmpty();
  }

  private FaultLogger() {}
}
