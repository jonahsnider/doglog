// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

import dev.doglog.internal.FaultLogger;
import dev.doglog.internal.LogQueuer;
import edu.wpi.first.hal.FRCNetComm;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.Alert;
import edu.wpi.first.wpilibj.Alert.AlertType;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.PowerDistribution;
import edu.wpi.first.wpilibj.Timer;

/** A logger based on WPILib's {@link DataLogManager} */
public class DogLog {
  static {
    HAL.report(
        FRCNetComm.tResourceType.kResourceType_LoggingFramework,
        FRCNetComm.tInstances.kLoggingFramework_DogLog);
  }

  /** The options to use for the logger. */
  protected static DogLogOptions options = new DogLogOptions();

  protected static final LogQueuer logger = new LogQueuer(options);

  /** Whether the logger is enabled. */
  protected static boolean enabled = true;

  /** Get the options used by the logger. */
  public static DogLogOptions getOptions() {
    return options;
  }

  /**
   * Update the options used by the logger.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withNtPublish(true));</pre>
   *
   * <p>See https://doglog.dev/reference/logger-options/ for more information.
   */
  public static void setOptions(DogLogOptions newOptions) {
    if (newOptions == null) {
      newOptions = new DogLogOptions();
    }

    var oldOptions = options;
    options = newOptions;

    if (!oldOptions.equals(newOptions)) {
      System.out.println("[DogLog] Options changed: " + newOptions.toString());
      logger.setOptions(newOptions);
    }
  }

  /**
   * Set the {@link PowerDistribution} instance to use for logging PDH/PDP data when logging extras
   * is enabled. If this is set to `null`, no PDH data will be logged. Otherwise, information like
   * battery voltage, device currents, etc. will be logged.
   *
   * <p>Example:
   *
   * <pre>DogLog.setPdh(new PowerDistribution());</pre>
   *
   * @param pdh The {@link PowerDistribution} instance to use for logging PDH/PDP data.
   */
  public static void setPdh(PowerDistribution pdh) {
    logger.setPdh(pdh);
  }

  /**
   * Set whether the logger is enabled. If the logger is not enabled, calls to `log()` functions
   * will not do anything.
   *
   * <p>By default, the logger is enabled.
   */
  public static void setEnabled(boolean newEnabled) {
    enabled = newEnabled;
  }

  /** Log a boolean array. */
  public static void log(String key, boolean[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a boolean. */
  public static void log(String key, boolean value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a double array. */
  public static void log(String key, double[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a double. */
  public static void log(String key, double value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a float array. */
  public static void log(String key, float[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a float. */
  public static void log(String key, float value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log an int array. */
  public static void log(String key, int[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a long array. */
  public static void log(String key, long[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a long. */
  public static void log(String key, long value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  // TODO: Raw logs

  /** Log a string array. */
  public static void log(String key, String[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log an enum array. Enums will be converted to strings with {@link Enum#name()}. */
  public static void log(String key, Enum<?>[] value) {
    if (value == null) {
      return;
    }
    // Convert enum array to string array
    var stringArray = new String[value.length];

    for (int i = 0; i < value.length; i++) {
      stringArray[i] = value[i].name();
    }

    log(key, stringArray);
  }

  /** Log a string. */
  public static void log(String key, String value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a string with a custom type string. */
  public static void log(String key, String value, String customTypeString) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value, customTypeString);
    }
  }

  /** Log an enum. The enum will be converted to a string with {@link Enum#name()}. */
  public static void log(String key, Enum<?> value) {
    if (value == null) {
      return;
    }
    log(key, value.name());
  }

  /** Log a struct array. */
  public static <T extends StructSerializable> void log(String key, T[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /** Log a struct. */
  public static <T extends StructSerializable> void log(String key, T value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.queueLog(now, key, value);
    }
  }

  /**
   * Log a fault and create an {@link Alert} for it at the specified level.
   *
   * <p>See https://doglog.dev/guides/faults for more information.
   *
   * @param faultName The name of the fault to log.
   * @param alertType The type of alert to create for the fault, or <code>null</code> if it should
   *     not create an alert
   * @see DogLog#decreaseFault(String)
   */
  public static void logFault(String faultName, AlertType alertType) {
    if (enabled && faultName != null) {
      FaultLogger.addFault(logger, faultName, alertType);
    }
  }

  /**
   * Log a fault and create an error type {@link Alert} for it.
   *
   * <p>See https://doglog.dev/guides/faults for more information.
   *
   * @param faultName The name of the fault to log.
   * @see DogLog#decreaseFault(String)
   */
  public static void logFault(String faultName) {
    logFault(faultName, AlertType.kError);
  }

  /**
   * Log a fault and create an error type {@link Alert} for it. The enum will be converted to a
   * string with {@link Enum#name()}.
   *
   * <p>See https://doglog.dev/guides/faults for more information.
   *
   * @param faultName The name of the fault to log.
   * @see DogLog#decreaseFault(Enum)
   */
  public static void logFault(Enum<?> faultName) {
    if (faultName != null) {
      logFault(faultName.name());
    }
  }

  /**
   * Lower the count of a fault by 1, unless it is already at 0. If there is an alert associated
   * with the fault, it will be set to inactive once the fault's count is 0.
   *
   * @param faultName The name of the fault to decrement the count of.
   * @see DogLog#clearFault(String)
   */
  public static void decreaseFault(String faultName) {
    if (enabled && faultName != null) {
      FaultLogger.decreaseFault(logger, faultName);
    }
  }

  /**
   * Lower the count of a fault by 1, unless it is already at 0. If there is an alert associated
   * with the fault, it will be set to inactive once the fault's count is 0.
   *
   * @param faultName The name of the fault to decrement the count of.
   * @see DogLog#clearFault(String)
   */
  public static void decreaseFault(Enum<?> faultName) {
    if (faultName != null) {
      decreaseFault(faultName.name());
    }
  }

  /**
   * Reset the count of a fault to 0, and set the alert associated with the fault to inactive if
   * possible.
   *
   * @param faultName The name of the fault to reset.
   */
  public static void clearFault(String faultName) {
    if (enabled && faultName != null) {
      FaultLogger.clearFault(logger, faultName);
    }
  }

  /**
   * Reset the count of a fault to 0, and set the alert associated with the fault to inactive if
   * possible.
   *
   * @param faultName The name of the fault to reset.
   */
  public static void clearFault(Enum<?> faultName) {
    if (faultName != null) {
      clearFault(faultName.name());
    }
  }

  /**
   * Check if faults have been logged using {@link DogLog#logFault(String)}.
   *
   * @return Whether any faults have been logged.
   */
  public static boolean faultsLogged() {
    return FaultLogger.faultsLogged();
  }

  /**
   * Check if any faults logged using logged using {@link DogLog#logFault(String)} are currently
   * active.
   *
   * @return Whether any faults are currently active.
   */
  public static boolean faultsActive() {
    return FaultLogger.faultsActive();
  }

  /**
   * Log the current FPGA timestamp. Useful for recording each time a block of code is executed,
   * since timestamps are unique and monotonically increasing.
   *
   * @param key The key to log the timestamp to.
   */
  public static void timestamp(String key) {
    log(key, Timer.getFPGATimestamp());
  }

  protected DogLog() {}
}
