package dev.doglog;

import dev.doglog.internal.EpochLogger;
import dev.doglog.internal.FaultLogger;
import dev.doglog.internal.TimedCommand;
import dev.doglog.internal.extras.ExtrasLogger;
import dev.doglog.internal.reporters.CombinedReporter;
import dev.doglog.internal.tunable.Tunable;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.networktables.BooleanSubscriber;
import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.FloatSubscriber;
import edu.wpi.first.networktables.IntegerSubscriber;
import edu.wpi.first.networktables.StringSubscriber;
import edu.wpi.first.util.function.BooleanConsumer;
import edu.wpi.first.util.function.FloatConsumer;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.Alert;
import edu.wpi.first.wpilibj.Alert.AlertType;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.PowerDistribution;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.Command;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.LongConsumer;

/** A logger based on WPILib's {@link DataLogManager} */
public class DogLog {
  private static final String USAGE_REPORT = "DogLog";

  static {
    HAL.reportUsage(USAGE_REPORT, "");
  }

  /** The options to use for the logger. */
  protected static DogLogOptions options = new DogLogOptions();

  protected static final CombinedReporter logger = new CombinedReporter(options);
  protected static final ExtrasLogger extras = new ExtrasLogger(logger, options);

  /** Whether the logger is enabled. */
  protected static boolean enabled = true;

  protected static final Tunable tunable = new Tunable(options);

  protected static final EpochLogger epochLogger = new EpochLogger(logger);

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
      tunable.setOptions(newOptions);
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
    extras.setPdh(pdh);
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

  /**
   * Returns whether the logger is enabled.
   *
   * @see DogLog#setEnabled(boolean)
   */
  public static boolean isEnabled() {
    return enabled;
  }

  /** Log a boolean array. */
  public static void log(String key, boolean[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
    }
  }

  /** Log a boolean. */
  public static void log(String key, boolean value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
    }
  }

  /** Log a double array. */
  public static void log(String key, double[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
    }
  }

  /** Log a double. */
  public static void log(String key, double value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
    }
  }

  /** Log a float array. */
  public static void log(String key, float[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
    }
  }

  /** Log a float. */
  public static void log(String key, float value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
    }
  }

  /** Log an int array. */
  public static void log(String key, int[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();

      var longArray = new long[value.length];
      for (int i = 0; i < value.length; i++) {
        longArray[i] = value[i];
      }
      logger.log(now, key, longArray);
    }
  }

  /** Log a long array. */
  public static void log(String key, long[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
    }
  }

  /** Log a long. */
  public static void log(String key, long value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
    }
  }

  // TODO: Raw logs

  /** Log a string array. */
  public static void log(String key, String[] value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
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
      logger.log(now, key, value);
    }
  }

  /** Log a string with a custom type string. */
  public static void log(String key, String value, String customTypeString) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value, customTypeString);
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
      logger.log(now, key, value);
    }
  }

  /** Log a struct. */
  public static <T extends StructSerializable> void log(String key, T value) {
    if (enabled) {
      var now = HALUtil.getFPGATime();
      logger.log(now, key, value);
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

  /**
   * Start a timer to track how long an operation takes to execute. When you call {@link
   * #timeEnd(String)} the duration of the operation in seconds will be logged to the specified key.
   *
   * @param key The key to start the timer for.
   * @see DogLog#timeEnd(String)
   */
  public static void time(String key) {
    epochLogger.time(key, HALUtil.getFPGATime());
  }

  /**
   * Wraps a {@link Command} with a timer that records how long the command runs. The command name
   * will be copied with a prefix of "Timed".
   *
   * @param key The key to log the duration of the command to.
   * @param command The command to wrap.
   * @see DogLog#time(String, Command)
   */
  public static Command time(String key, Command command) {
    return new TimedCommand(command, key);
  }

  /**
   * Stop a timer started with {@link #time(String)} and log the duration in seconds to the
   * specified key.
   *
   * @param key The key to stop the timer for.
   * @see DogLog#time(String)
   */
  public static void timeEnd(String key) {
    epochLogger.timeEnd(key, HALUtil.getFPGATime());
  }

  /**
   * Create a tunable double.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(String key, double defaultValue) {
    return tunable(key, defaultValue, null);
  }

  /**
   * Create a tunable double.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(String key, double defaultValue, DoubleConsumer onChange) {
    return tunable.create(key, defaultValue, onChange);
  }

  /**
   * Create a tunable float.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return A {@link FloatSubscriber} used to retrieve the tunable value.
   */
  public static FloatSubscriber tunable(String key, float defaultValue) {
    return tunable(key, defaultValue, (FloatConsumer) null);
  }

  /**
   * Create a tunable float.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link FloatSubscriber} used to retrieve the tunable value.
   */
  public static FloatSubscriber tunable(String key, float defaultValue, FloatConsumer onChange) {
    return tunable.create(key, defaultValue, onChange);
  }

  /**
   * Create a tunable boolean.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return A {@link BooleanSubscriber} used to retrieve the tunable value.
   */
  public static BooleanSubscriber tunable(String key, boolean defaultValue) {
    return tunable(key, defaultValue, null);
  }

  /**
   * Create a tunable boolean.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link BooleanSubscriber} used to retrieve the tunable value.
   */
  public static BooleanSubscriber tunable(
      String key, boolean defaultValue, BooleanConsumer onChange) {
    return tunable.create(key, defaultValue, onChange);
  }

  /**
   * Create a tunable string.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return A {@link StringSubscriber} used to retrieve the tunable value.
   */
  public static StringSubscriber tunable(String key, String defaultValue) {
    return tunable(key, defaultValue, null);
  }

  /**
   * Create a tunable string.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link StringSubscriber} used to retrieve the tunable value.
   */
  public static StringSubscriber tunable(
      String key, String defaultValue, Consumer<String> onChange) {
    return tunable.create(key, defaultValue, onChange);
  }

  /**
   * Create a tunable integer.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return An {@link IntegerSubscriber} used to retrieve the tunable value.
   */
  public static IntegerSubscriber tunable(String key, long defaultValue) {
    return tunable(key, defaultValue, (LongConsumer) null);
  }

  /**
   * Create a tunable integer.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return An {@link IntegerSubscriber} used to retrieve the tunable value.
   */
  public static IntegerSubscriber tunable(String key, long defaultValue, LongConsumer onChange) {
    return tunable.create(key, defaultValue, onChange);
  }

  protected DogLog() {}
}
