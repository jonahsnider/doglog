package dev.doglog;

import dev.doglog.internal.DogLogForceNt;
import dev.doglog.internal.EpochLogger;
import dev.doglog.internal.FaultLogger;
import dev.doglog.internal.TimedCommand;
import dev.doglog.internal.tunable.Tunable;
import dev.doglog.internal.writers.LogWriterHighLevel;
import edu.wpi.first.hal.FRCNetComm;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.networktables.BooleanSubscriber;
import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.FloatSubscriber;
import edu.wpi.first.networktables.IntegerSubscriber;
import edu.wpi.first.networktables.StringSubscriber;
import edu.wpi.first.units.Measure;
import edu.wpi.first.units.Unit;
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
import org.jspecify.annotations.Nullable;

/** A logger based on WPILib's {@link DataLogManager} */
public class DogLog {
  static {
    HAL.report(
        FRCNetComm.tResourceType.kResourceType_LoggingFramework,
        FRCNetComm.tInstances.kLoggingFramework_DogLog);
  }

  /** The options to use for the logger. */
  protected static DogLogOptions options = new DogLogOptions();

  protected static LogWriterHighLevel logger = LogWriterHighLevel.create(options);

  /** Whether the logger is enabled. */
  protected static boolean enabled = true;

  /**
   * Use <code>DogLog.nt.log()</code> to log values to both DataLog and NetworkTables, regardless of
   * the <code>ntPublish</code> option.
   */
  public static final DogLogForceNt nt = new DogLogForceNt(enabled, logger);

  protected static final Tunable tunable = new Tunable(options);

  protected static final EpochLogger epochLogger = new EpochLogger();

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
  public static void setOptions(@Nullable DogLogOptions newOptions) {
    if (newOptions == null) {
      newOptions = new DogLogOptions();
    }

    var oldOptions = options;
    options = newOptions;

    if (!oldOptions.equals(newOptions)) {
      System.out.println("[DogLog] Options changed: " + newOptions);
      logger.setOptions(newOptions);
      if (oldOptions.useLogThread() != newOptions.useLogThread()) {
        // Create the new logger before we close the old one, to avoid race condition
        var oldLogger = logger;
        logger = LogWriterHighLevel.create(newOptions);

        try {
          oldLogger.close();
        } catch (Exception e) {
          System.err.println("[DogLog] Error closing old LogWriter instance:");
          e.printStackTrace();
        }
      }
      tunable.setOptions(newOptions);
    }

    nt.setLogger(logger);
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
  public static void setPdh(@Nullable PowerDistribution pdh) {
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
    nt.setEnabled(newEnabled);
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
  public static void log(String key, boolean @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a boolean. */
  public static void log(String key, boolean value) {
    if (!enabled) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a double array. */
  public static void log(String key, double @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a double array with unit metadata. */
  public static void log(String key, double @Nullable [] value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value, unit);
  }

  /** Log a double array with unit metadata. */
  public static void log(String key, double @Nullable [] value, @Nullable Unit unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    log(key, value, unit.name());
  }

  /** Log a double. */
  public static void log(String key, double value) {
    if (!enabled) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a double with unit metadata. */
  public static void log(String key, double value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value, unit);
  }

  /** Log a double with unit metadata. */
  public static void log(String key, double value, @Nullable Unit unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    log(key, value, unit.name());
  }

  /** Log a measure, preserving the user-specified unit. */
  public static void log(String key, @Nullable Measure<?> value) {
    if (!enabled || value == null) {
      return;
    }

    log(key, value.magnitude(), value.unit().name());
  }

  /** Log a float array. */
  public static void log(String key, float @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a float array with unit metadata. */
  public static void log(String key, float @Nullable [] value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value, unit);
  }

  /** Log a float. */
  public static void log(String key, float value) {
    if (!enabled) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a float with unit metadata. */
  public static void log(String key, float value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value, unit);
  }

  /** Log an int array. */
  public static void log(String key, int @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a long array. */
  public static void log(String key, long @Nullable [] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a long array with unit metadata. */
  public static void log(String key, long @Nullable [] value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value, unit);
  }

  /** Log a long. */
  public static void log(String key, long value) {
    if (!enabled) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a long with unit metadata. */
  public static void log(String key, long value, @Nullable String unit) {
    if (!enabled) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value, unit);
  }

  // TODO: Raw logs

  /** Log a string array. */
  public static void log(String key, @Nullable String[] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log an enum array. */
  public static <E extends Enum<E>> void log(String key, @Nullable E[] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a string. */
  public static void log(String key, @Nullable String value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a string with a custom type string. */
  public static void log(String key, @Nullable String value, @Nullable String customTypeString) {
    if (!enabled || value == null) {
      return;
    }

    if (customTypeString == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value, customTypeString);
  }

  /** Log an enum. */
  public static <E extends Enum<E>> void log(String key, @Nullable E value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a struct array. */
  public static <T extends StructSerializable> void log(String key, @Nullable T[] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a struct. */
  public static <T extends StructSerializable> void log(String key, @Nullable T value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a record. */
  public static void log(String key, @Nullable Record value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
  }

  /** Log a record array. */
  public static void log(String key, @Nullable Record[] value) {
    if (!enabled || value == null) {
      return;
    }

    var now = HALUtil.getFPGATime();
    logger.log(now, key, false, value);
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
  public static void logFault(@Nullable String faultName, @Nullable AlertType alertType) {
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
  public static void logFault(@Nullable String faultName) {
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
  public static void logFault(@Nullable Enum<?> faultName) {
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
  public static void decreaseFault(@Nullable String faultName) {
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
  public static void decreaseFault(@Nullable Enum<?> faultName) {
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
  public static void clearFault(@Nullable String faultName) {
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
  public static void clearFault(@Nullable Enum<?> faultName) {
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
    epochLogger.timeEnd(key, HALUtil.getFPGATime(), logger);
  }

  /**
   * Create a tunable double.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(String key, double defaultValue) {
    return tunable(key, defaultValue, (DoubleConsumer) null);
  }

  /**
   * Create a tunable double.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(
      String key, double defaultValue, @Nullable DoubleConsumer onChange) {
    return tunable.create(key, defaultValue, null, onChange);
  }

  /**
   * Create a tunable double with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(String key, double defaultValue, @Nullable String unit) {
    return tunable(key, defaultValue, unit, (DoubleConsumer) null);
  }

  /**
   * Create a tunable double with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(
      String key, double defaultValue, @Nullable String unit, @Nullable DoubleConsumer onChange) {
    return tunable.create(key, defaultValue, unit, onChange);
  }

  /**
   * Create a tunable double with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(String key, double defaultValue, @Nullable Unit unit) {
    return tunable(key, defaultValue, unit, (DoubleConsumer) null);
  }

  /**
   * Create a tunable double with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(
      String key, double defaultValue, @Nullable Unit unit, @Nullable DoubleConsumer onChange) {
    if (unit == null) {
      return tunable(key, defaultValue, onChange);
    }
    return tunable(key, defaultValue, unit.name(), onChange);
  }

  /**
   * Create a tunable from a measure, preserving the user-specified unit.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default measure value for the tunable value.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(String key, Measure<?> defaultValue) {
    return tunable(key, defaultValue, null);
  }

  /**
   * Create a tunable from a measure, preserving the user-specified unit.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default measure value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(
      String key, @Nullable Measure<?> defaultValue, @Nullable DoubleConsumer onChange) {
    if (defaultValue == null) {
      return tunable(key, 0.0, onChange);
    }
    return tunable(key, defaultValue.magnitude(), defaultValue.unit().name(), onChange);
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
  public static FloatSubscriber tunable(
      String key, float defaultValue, @Nullable FloatConsumer onChange) {
    return tunable.create(key, defaultValue, null, onChange);
  }

  /**
   * Create a tunable float with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return A {@link FloatSubscriber} used to retrieve the tunable value.
   */
  public static FloatSubscriber tunable(String key, float defaultValue, String unit) {
    return tunable(key, defaultValue, unit, (FloatConsumer) null);
  }

  /**
   * Create a tunable float with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link FloatSubscriber} used to retrieve the tunable value.
   */
  public static FloatSubscriber tunable(
      String key, float defaultValue, String unit, @Nullable FloatConsumer onChange) {
    return tunable.create(key, defaultValue, unit, onChange);
  }

  /**
   * Create a tunable float with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return A {@link FloatSubscriber} used to retrieve the tunable value.
   */
  public static FloatSubscriber tunable(String key, float defaultValue, Unit unit) {
    return tunable(key, defaultValue, unit, (FloatConsumer) null);
  }

  /**
   * Create a tunable float with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link FloatSubscriber} used to retrieve the tunable value.
   */
  public static FloatSubscriber tunable(
      String key, float defaultValue, @Nullable Unit unit, @Nullable FloatConsumer onChange) {
    if (unit == null) {
      return tunable(key, defaultValue, onChange);
    }
    return tunable(key, defaultValue, unit.name(), onChange);
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
      String key, boolean defaultValue, @Nullable BooleanConsumer onChange) {
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
      String key, String defaultValue, @Nullable Consumer<String> onChange) {
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
  public static IntegerSubscriber tunable(
      String key, long defaultValue, @Nullable LongConsumer onChange) {
    return tunable.create(key, defaultValue, null, onChange);
  }

  /**
   * Create a tunable integer with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return An {@link IntegerSubscriber} used to retrieve the tunable value.
   */
  public static IntegerSubscriber tunable(String key, long defaultValue, @Nullable String unit) {
    return tunable(key, defaultValue, unit, (LongConsumer) null);
  }

  /**
   * Create a tunable integer with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return An {@link IntegerSubscriber} used to retrieve the tunable value.
   */
  public static IntegerSubscriber tunable(
      String key, long defaultValue, @Nullable String unit, @Nullable LongConsumer onChange) {
    return tunable.create(key, defaultValue, unit, onChange);
  }

  /**
   * Create a tunable integer with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return An {@link IntegerSubscriber} used to retrieve the tunable value.
   */
  public static IntegerSubscriber tunable(String key, long defaultValue, @Nullable Unit unit) {
    return tunable(key, defaultValue, unit, (LongConsumer) null);
  }

  /**
   * Create a tunable integer with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return An {@link IntegerSubscriber} used to retrieve the tunable value.
   */
  public static IntegerSubscriber tunable(
      String key, long defaultValue, @Nullable Unit unit, @Nullable LongConsumer onChange) {
    if (unit == null) {
      return tunable(key, defaultValue, onChange);
    }
    return tunable(key, defaultValue, unit.name(), onChange);
  }

  protected DogLog() {}
}
