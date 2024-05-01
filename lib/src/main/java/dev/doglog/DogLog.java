// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

import dev.doglog.internal.extras.ExtrasLogger;
import dev.doglog.internal.log_thread.LogQueuer;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.Timer;

/** A logger based on WPILib's {@link DataLogManager} */
public class DogLog {
  private static final double LOOP_PERIOD_SECONDS = 0.02;

  /** The options to use for the logger. */
  protected static DogLogOptions options = new DogLogOptions();

  protected static final LogQueuer logger = new LogQueuer(options);

  /** Whether the logger is enabled. */
  protected static boolean enabled = true;

  protected static final Timer extrasTimer = new Timer();

  static {
    extrasTimer.start();
  }

  /** Get the options used by the logger. */
  public static DogLogOptions getOptions() {
    return options;
  }

  /** Update the options used by the logger. */
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
   * Set whether the logger is enabled. If the logger is not enabled, calls to `log()` functions
   * will not do anything.
   */
  public static void setEnabled(boolean newEnabled) {
    enabled = newEnabled;
  }

  /** Log a boolean array. */
  public static void log(String key, boolean[] value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a boolean. */
  public static void log(String key, boolean value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a double array. */
  public static void log(String key, double[] value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a double. */
  public static void log(String key, double value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a float array. */
  public static void log(String key, float[] value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a float. */
  public static void log(String key, float value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log an int array. */
  public static void log(String key, int[] value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a long array. */
  public static void log(String key, long[] value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a long. */
  public static void log(String key, long value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  /** Log a string array. */
  public static void log(String key, String[] value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log an enum array. Enums will be converted to strings with {@link Enum#name()}. */
  public static void log(String key, Enum<?>[] value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a string. */
  public static void log(String key, String value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log an enum. The enum will be converted to a string with {@link Enum#name()}. */
  public static void log(String key, Enum<?> value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a struct array. */
  public static <T extends StructSerializable> void log(String key, T[] value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  /** Log a struct. */
  public static <T extends StructSerializable> void log(String key, T value) {
    if (enabled) {
      logger.queueLog(key, value);
    }
    logExtrasIfPeriodElapsed();
  }

  protected static void logExtrasIfPeriodElapsed() {
    if (enabled && options.logExtras() && extrasTimer.hasElapsed(LOOP_PERIOD_SECONDS)) {
      ExtrasLogger.log(logger);
      extrasTimer.reset();
    }
  }

  protected DogLog() {}
}
