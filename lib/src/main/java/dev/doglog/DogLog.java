package dev.doglog;

import com.google.errorprone.annotations.ThreadSafe;
import dev.doglog.internal.EpochLogger;
import dev.doglog.internal.FaultLogger;
import dev.doglog.internal.TimedCommand;
import dev.doglog.internal.TimedCommandV3;
import dev.doglog.internal.tunable.Tunable;
import dev.doglog.internal.writers.LogWriter;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.LongConsumer;
import org.jspecify.annotations.Nullable;
import org.wpilib.command2.Command;
import org.wpilib.driverstation.Alert;
import org.wpilib.driverstation.Alert.Level;
import org.wpilib.hardware.hal.HAL;
import org.wpilib.hardware.hal.HALUtil;
import org.wpilib.hardware.power.PowerDistribution;
import org.wpilib.networktables.BooleanSubscriber;
import org.wpilib.networktables.DoubleArraySubscriber;
import org.wpilib.networktables.DoubleSubscriber;
import org.wpilib.networktables.FloatSubscriber;
import org.wpilib.networktables.IntegerSubscriber;
import org.wpilib.networktables.StringSubscriber;
import org.wpilib.system.DataLogManager;
import org.wpilib.system.Timer;
import org.wpilib.units.Measure;
import org.wpilib.units.Unit;
import org.wpilib.util.WPISerializable;
import org.wpilib.util.function.BooleanConsumer;
import org.wpilib.util.function.FloatConsumer;
import org.wpilib.util.struct.StructSerializable;

/** A logger based on WPILib's {@link DataLogManager} */
@ThreadSafe
public class DogLog {
  static {
    HAL.reportUsage("LoggingFramework", "DogLog");
  }

  /** The options to use for the logger. */
  protected static final AtomicReference<DogLogOptions> options =
      new AtomicReference<>(new DogLogOptions());

  @SuppressWarnings("NullAway")
  protected static final LogWriter logger = new LogWriter(options.get());

  /** Whether the logger is enabled. */
  protected static final AtomicBoolean enabled = new AtomicBoolean(true);

  @SuppressWarnings("NullAway")
  protected static final Tunable tunable = new Tunable(options.get());

  protected static final EpochLogger epochLogger = new EpochLogger();

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
   * Reset the count of a fault to 0, and set the alert associated with the fault to inactive if
   * possible.
   *
   * @param faultName The name of the fault to reset.
   */
  public static void clearFault(@Nullable String faultName) {
    if (enabled.get() && faultName != null) {
      FaultLogger.clearFault(logger, faultName);
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
   * Lower the count of a fault by 1, unless it is already at 0. If there is an alert associated
   * with the fault, it will be set to inactive once the fault's count is 0.
   *
   * @param faultName The name of the fault to decrement the count of.
   * @see DogLog#clearFault(String)
   */
  public static void decreaseFault(@Nullable String faultName) {
    if (enabled.get() && faultName != null) {
      FaultLogger.decreaseFault(logger, faultName);
    }
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
   * Check if faults have been logged using {@link DogLog#logFault(String)}.
   *
   * @return Whether any faults have been logged.
   */
  public static boolean faultsLogged() {
    return FaultLogger.faultsLogged();
  }

  /** Get the options used by the logger. */
  @SuppressWarnings("NullAway")
  public static DogLogOptions getOptions() {
    return options.get();
  }

  /**
   * Returns whether the logger is enabled.
   *
   * @see DogLog#setEnabled(boolean)
   */
  public static boolean isEnabled() {
    return enabled.get();
  }

  /** Log a boolean. */
  public static void log(String key, boolean value) {
    if (!enabled.get()) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a boolean array. */
  public static void log(String key, boolean @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a double. */
  public static void log(String key, double value) {
    if (!enabled.get()) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a double with unit metadata. */
  public static void log(String key, double value, @Nullable String unit) {
    if (!enabled.get()) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value, unit);
  }

  /** Log a double with unit metadata. */
  public static void log(String key, double value, @Nullable Unit unit) {
    if (!enabled.get()) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    log(key, value, unit.name());
  }

  /** Log a double array. */
  public static void log(String key, double @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a double array with unit metadata. */
  public static void log(String key, double @Nullable [] value, @Nullable String unit) {
    if (!enabled.get()) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value, unit);
  }

  /** Log a double array with unit metadata. */
  public static void log(String key, double @Nullable [] value, @Nullable Unit unit) {
    if (!enabled.get()) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    log(key, value, unit.name());
  }

  /** Log an enum. */
  public static <E extends Enum<E>> void log(String key, @Nullable E value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log an enum array. */
  public static <E extends Enum<E>> void log(String key, @Nullable E[] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a float. */
  public static void log(String key, float value) {
    if (!enabled.get()) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a float with unit metadata. */
  public static void log(String key, float value, @Nullable String unit) {
    if (!enabled.get()) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value, unit);
  }

  /** Log a float array. */
  public static void log(String key, float @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a float array with unit metadata. */
  public static void log(String key, float @Nullable [] value, @Nullable String unit) {
    if (!enabled.get()) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value, unit);
  }

  // TODO: Raw logs

  /** Log an int array. */
  public static void log(String key, int @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a long. */
  public static void log(String key, long value) {
    if (!enabled.get()) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a long with unit metadata. */
  public static void log(String key, long value, @Nullable String unit) {
    if (!enabled.get()) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value, unit);
  }

  /** Log a long array. */
  public static void log(String key, long @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a long array with unit metadata. */
  public static void log(String key, long @Nullable [] value, @Nullable String unit) {
    if (!enabled.get()) {
      return;
    }
    if (unit == null) {
      log(key, value);
      return;
    }
    if (value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value, unit);
  }

  /** Log a record. */
  public static void log(String key, @Nullable Record value) {
    if (!enabled.get() || value == null) {
      return;
    }

    // Measure extends Record and javac is crashing if we try having a log(String, Measure)
    // overload, so we handle it at runtime here
    if (value instanceof Measure<?> measure) {
      var unit = measure.unit();
      if (unit == null) {
        log(key, measure.magnitude());
        return;
      }
      log(key, measure.magnitude(), unit.name());
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a record array. */
  public static void log(String key, @Nullable Record[] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a string. */
  public static void log(String key, @Nullable String value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a string with a custom type string. */
  public static void log(String key, @Nullable String value, @Nullable String customTypeString) {
    if (!enabled.get() || value == null) {
      return;
    }

    if (customTypeString == null) {
      log(key, value);
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value, customTypeString);
  }

  /** Log a string array. */
  public static void log(String key, @Nullable String[] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a struct or protobuf. Struct is preferred, with protobuf used as a fallback. */
  public static <T extends WPISerializable> void log(String key, @Nullable T value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
  }

  /** Log a struct array. */
  public static <T extends StructSerializable> void log(String key, @Nullable T[] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    var now = HALUtil.getMonotonicTime();
    logger.log(now, key, value);
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
   * Log a fault and create an error type {@link Alert} for it.
   *
   * <p>See https://doglog.dev/guides/faults for more information.
   *
   * @param faultName The name of the fault to log.
   * @see DogLog#decreaseFault(String)
   */
  public static void logFault(@Nullable String faultName) {
    logFault(faultName, Level.HIGH);
  }

  /**
   * Log a fault and create an {@link Alert} for it at the specified level.
   *
   * <p>See https://doglog.dev/guides/faults for more information.
   *
   * @param faultName The name of the fault to log.
   * @param alertLevel The level of alert to create for the fault, or <code>null</code> if it should
   *     not create an alert
   * @see DogLog#decreaseFault(String)
   */
  public static void logFault(@Nullable String faultName, @Nullable Level alertLevel) {
    if (enabled.get() && faultName != null) {
      FaultLogger.addFault(logger, faultName, alertLevel);
    }
  }

  /**
   * Set whether the logger is enabled. If the logger is not enabled, calls to `log()` functions
   * will not do anything.
   *
   * <p>By default, the logger is enabled.
   */
  public static void setEnabled(boolean newEnabled) {
    enabled.set(newEnabled);
  }

  /**
   * Update the options used by the logger.
   *
   * <p>Example:
   *
   * <pre>DogLog.setOptions(new DogLogOptions().withCaptureDs(true));</pre>
   *
   * <p>See https://doglog.dev/reference/logger-options/ for more information.
   */
  @SuppressWarnings("NullAway")
  public static synchronized void setOptions(@Nullable DogLogOptions newOptions) {
    if (newOptions == null) {
      newOptions = new DogLogOptions();
    }

    var oldOptions = options.getAndSet(newOptions);

    if (!oldOptions.equals(newOptions)) {
      System.out.println("[DogLog] Options changed: " + newOptions);
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
  public static void setPdh(@Nullable PowerDistribution pdh) {
    logger.setPdh(pdh);
  }

  /**
   * Start a timer to track how long an operation takes to execute. When you call {@link
   * #timeEnd(String)} the duration of the operation in seconds will be logged to the specified key.
   *
   * @param key The key to start the timer for.
   * @see DogLog#timeEnd(String)
   */
  public static void time(String key) {
    epochLogger.time(key, HALUtil.getMonotonicTime());
  }

  /**
   * Wraps a Commands v2 {@link Command} with a timer that records how long the command runs. The
   * command name will be copied with a prefix of "Timed".
   *
   * @param key The key to log the duration of the command to.
   * @param command The command to wrap.
   * @see DogLog#time(String, Command)
   */
  public static Command time(String key, Command command) {
    return new TimedCommand(command, key);
  }

  /**
   * Wraps a Commands v3 {@link org.wpilib.command3.Command} with a timer that logs the total
   * duration of the command in seconds. The command name will be copied with a prefix of "Timed".
   *
   * @param key The key to log the duration of the command to.
   * @param command The command to wrap.
   */
  public static org.wpilib.command3.Command time(String key, org.wpilib.command3.Command command) {
    return new TimedCommandV3(command, key);
  }

  /**
   * Stop a timer started with {@link #time(String)} and log the duration in seconds to the
   * specified key.
   *
   * @param key The key to stop the timer for.
   * @see DogLog#time(String)
   */
  public static void timeEnd(String key) {
    epochLogger.timeEnd(key, HALUtil.getMonotonicTime(), logger);
  }

  /**
   * Log the current FPGA timestamp. Useful for recording each time a block of code is executed,
   * since timestamps are unique and monotonically increasing.
   *
   * @param key The key to log the timestamp to.
   */
  public static void timestamp(String key) {
    log(key, Timer.getMonotonicTimestamp());
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
   * Create a tunable double array.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return A {@link DoubleArraySubscriber} used to retrieve the tunable value.
   */
  public static DoubleArraySubscriber tunable(String key, double[] defaultValue) {
    return tunable(key, defaultValue, (Consumer<double[]>) null);
  }

  /**
   * Create a tunable double array.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link DoubleArraySubscriber} used to retrieve the tunable value.
   */
  public static DoubleArraySubscriber tunable(
      String key, double[] defaultValue, @Nullable Consumer<double[]> onChange) {
    return tunable.create(key, defaultValue, null, onChange);
  }

  /**
   * Create a tunable double array with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return A {@link DoubleArraySubscriber} used to retrieve the tunable value.
   */
  public static DoubleArraySubscriber tunable(
      String key, double[] defaultValue, @Nullable String unit) {
    return tunable(key, defaultValue, unit, (Consumer<double[]>) null);
  }

  /**
   * Create a tunable double array with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link DoubleArraySubscriber} used to retrieve the tunable value.
   */
  public static DoubleArraySubscriber tunable(
      String key,
      double[] defaultValue,
      @Nullable String unit,
      @Nullable Consumer<double[]> onChange) {
    return tunable.create(key, defaultValue, unit, onChange);
  }

  /**
   * Create a tunable double array with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return A {@link DoubleArraySubscriber} used to retrieve the tunable value.
   */
  public static DoubleArraySubscriber tunable(
      String key, double[] defaultValue, @Nullable Unit unit) {
    return tunable(key, defaultValue, unit, (Consumer<double[]>) null);
  }

  /**
   * Create a tunable double array with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return A {@link DoubleArraySubscriber} used to retrieve the tunable value.
   */
  public static DoubleArraySubscriber tunable(
      String key,
      double[] defaultValue,
      @Nullable Unit unit,
      @Nullable Consumer<double[]> onChange) {
    if (unit == null) {
      return tunable(key, defaultValue, onChange);
    }
    return tunable(key, defaultValue, unit.name(), onChange);
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

  /**
   * Create a tunable from a measure, preserving the user-specified unit.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default measure value for the tunable value.
   * @return A {@link DoubleSubscriber} used to retrieve the tunable value.
   */
  public static DoubleSubscriber tunable(String key, Measure<?> defaultValue) {
    // WPILib Measure is immutable, but its interface is not annotated @ThreadSafe.
    // @infer-ignore INTERFACE_NOT_THREAD_SAFE
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

    return tunable(
        key,
        // WPILib Measure is immutable, but its interface is not annotated @ThreadSafe.
        // @infer-ignore INTERFACE_NOT_THREAD_SAFE
        defaultValue.magnitude(),
        defaultValue.unit().name(),
        onChange);
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

  protected DogLog() {}
}
