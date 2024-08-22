// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

import dev.doglog.internal.FaultLogger;
import dev.doglog.internal.LogQueuer;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.PowerDistribution;

/** A logger based on WPILib's {@link DataLogManager} */
public class DogLog {
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

  // TODO: Protobuf logs

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
   * Log a fault.
   *
   * <p>See https://doglog.dev/guides/faults for more information.
   *
   * @param faultName The name of the fault to log.
   */
  public static void logFault(String faultName) {
    if (enabled) {
      FaultLogger.logFault(logger, faultName);
    }
  }

  /**
   * Log a fault. The enum will be converted to a string with {@link Enum#name()}.
   *
   * <p>See https://doglog.dev/guides/faults for more information.
   *
   * @param faultName The name of the fault to log.
   */
  public static void logFault(Enum<?> faultName) {
    logFault(faultName.name());
  }

  /**
   * Check if faults have been logged using {@link DogLog#logFault(String)}.
   *
   * @return Whether any faults have been logged.
   */
  public static boolean faultsLogged() {
    return FaultLogger.faultsLogged();
  }

  protected DogLog() {}
}
