package dev.doglog.internal;

import dev.doglog.internal.writers.LogWriter;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.wpilib.driverstation.Alert;
import org.wpilib.driverstation.Alert.Level;
import org.wpilib.hardware.hal.HALUtil;

/**
 * Provides the interface for logging faults. Faults are a DogLog concept that were created prior to
 * WPILib alerts. Alerts are great but are NT only, so faults allow DogLog to provide a simple
 * interface to logging errors that writes to both NT and DataLog.
 */
public class FaultLogger {
  private static final Map<String, Integer> FAULT_COUNTS = new HashMap<>();
  private static final Map<String, Alert> FAULT_ALERTS = new HashMap<>();

  /** Faults that are currently active. */
  private static final Set<String> ACTIVE_FAULTS = new HashSet<>();

  // This function doesn't need to have the LogConsumer parameter, it could just call DogLog
  // directly. But doing that would mean getting the current time twice, which can be avoided by
  // getting the time once here and reusing that value.
  public static void addFault(LogWriter logger, String faultName) {
    var previousCount = FAULT_COUNTS.get(faultName);
    var newCount = previousCount == null ? 1 : previousCount + 1;
    FAULT_COUNTS.put(faultName, newCount);

    var now = HALUtil.getMonotonicTime();

    if (previousCount == null) {
      // A new fault has been seen
      logger.log(now, "Faults/Seen", FAULT_COUNTS.keySet().toArray(String[]::new));
    }
    if (previousCount == null || previousCount == 0) {
      // Fault has just become active
      ACTIVE_FAULTS.add(faultName);
      logger.log(now, "Faults/Active", ACTIVE_FAULTS.toArray(String[]::new));
    }
    logger.log(now, "Faults/Counts/" + faultName, newCount);
  }

  /**
   * Log a fault.
   *
   * @param logger LogConsumer to use.
   * @param faultName The name of the fault to log.
   * @param alertLevel The level of alert to create for the fault, or <code>null</code> if it should
   *     not create an alert
   */
  public static void addFault(LogWriter logger, String faultName, @Nullable Level alertLevel) {
    addFault(logger, faultName);
    if (alertLevel != null) {
      FAULT_ALERTS.computeIfAbsent(faultName, k -> new Alert(faultName, alertLevel)).set(true);
    }
  }

  public static void clearFault(LogWriter logger, String faultName) {
    // The faultCounts map is used to track the seen faults, so we need to make sure that clearing a
    // fault which has never occurred doesn't mark it as seen with a count of 0
    var previousValue = FAULT_COUNTS.replace(faultName, 0);

    if (previousValue != null) {
      var now = HALUtil.getMonotonicTime();
      logger.log(now, "Faults/Counts/" + faultName, 0);

      var alert = FAULT_ALERTS.get(faultName);
      if (alert != null) {
        alert.set(false);
      }

      ACTIVE_FAULTS.remove(faultName);
      logger.log(now, "Faults/Active", ACTIVE_FAULTS.toArray(String[]::new));
    }
  }

  /**
   * Remove the alert associated with a fault.
   *
   * @param logger LogConsumer to use.
   * @param faultName The name of the fault to remove.
   */
  public static void decreaseFault(LogWriter logger, String faultName) {
    var previousCount = FAULT_COUNTS.get(faultName);
    if (previousCount == null || previousCount == 0) {
      // This fault has never occurred
      return;
    }
    var newCount = previousCount - 1;
    FAULT_COUNTS.put(faultName, newCount);

    var now = HALUtil.getMonotonicTime();
    logger.log(now, "Faults/Counts/" + faultName, newCount);

    if (newCount == 0) {
      // Mark alert as inactive if it exists
      var alert = FAULT_ALERTS.get(faultName);

      if (alert != null) {
        alert.set(false);
      }

      ACTIVE_FAULTS.remove(faultName);
      logger.log(now, "Faults/Active", ACTIVE_FAULTS.toArray(String[]::new));
    }
  }

  public static boolean faultsActive() {
    return !ACTIVE_FAULTS.isEmpty();
  }

  public static boolean faultsLogged() {
    return !FAULT_COUNTS.isEmpty();
  }

  private FaultLogger() {}
}
