package dev.doglog;

import com.google.errorprone.annotations.ThreadSafe;
import dev.doglog.internal.EpochLogger;
import dev.doglog.internal.FaultLogger;
import dev.doglog.internal.StructRegistry;
import dev.doglog.internal.extras.ExtrasLogger;
import dev.doglog.internal.tunable.TunableManager;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.LongConsumer;
import org.jspecify.annotations.Nullable;
import org.wpilib.driverstation.DriverStation;
import org.wpilib.hardware.hal.HAL;
import org.wpilib.hardware.hal.HALUtil;
import org.wpilib.hardware.power.PowerDistribution;
import org.wpilib.internal.UnitTelemetry;
import org.wpilib.system.DataLogManager;
import org.wpilib.system.Timer;
import org.wpilib.telemetry.Telemetry;
import org.wpilib.tunable.Tunable;
import org.wpilib.tunable.TunableBoolean;
import org.wpilib.tunable.TunableDouble;
import org.wpilib.tunable.TunableFloat;
import org.wpilib.tunable.TunableLong;
import org.wpilib.units.Measure;
import org.wpilib.units.Unit;
import org.wpilib.util.Alert;
import org.wpilib.util.Alert.Level;
import org.wpilib.util.WPISerializable;
import org.wpilib.util.function.BooleanConsumer;
import org.wpilib.util.function.FloatConsumer;
import org.wpilib.util.struct.Struct;
import org.wpilib.util.struct.StructSerializable;

/** A logger based on WPILib's {@link Telemetry} API. */
@ThreadSafe
public class DogLog {
  /** The options to use for the logger. */
  protected static final AtomicReference<DogLogOptions> options =
      new AtomicReference<>(new DogLogOptions());

  /** Whether the logger is enabled. */
  protected static final AtomicBoolean enabled = new AtomicBoolean(true);

  private static final Map<String, Boolean> SOURCED_KEYS = new ConcurrentHashMap<>();
  private static final StructRegistry STRUCT_REGISTRY = new StructRegistry();

  private static final ExtrasLogger EXTRAS;

  static {
    var initialOptions = getOptions();
    HAL.reportUsage("LoggingFramework", "DogLog");
    DataLogManager.logConsoleOutput(initialOptions.captureConsole());
    EXTRAS = new ExtrasLogger(initialOptions);
  }

  private static final TunableManager TUNABLE_MANAGER = new TunableManager(getOptions());

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
      FaultLogger.clearFault(faultName);
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
      FaultLogger.decreaseFault(faultName);
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

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a boolean array. */
  public static void log(String key, boolean @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a double. */
  public static void log(String key, double value) {
    if (!enabled.get()) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a double with unit metadata. */
  public static void log(String key, double value, @Nullable String unit) {
    if (unit == null) {
      log(key, value);
      return;
    }
    if (!enabled.get()) {
      return;
    }

    prepareKey(key);
    setUnit(key, unit);
    Telemetry.log(key, value);
  }

  /** Log a double with unit metadata. */
  public static void log(String key, double value, @Nullable Unit unit) {
    log(key, value, unit == null ? null : unit.name());
  }

  /** Log a double array. */
  public static void log(String key, double @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a double array with unit metadata. */
  public static void log(String key, double @Nullable [] value, @Nullable String unit) {
    if (unit == null) {
      log(key, value);
      return;
    }
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    setUnit(key, unit);
    Telemetry.log(key, value);
  }

  /** Log a double array with unit metadata. */
  public static void log(String key, double @Nullable [] value, @Nullable Unit unit) {
    log(key, value, unit == null ? null : unit.name());
  }

  /** Log an enum. */
  public static <E extends Enum<E>> void log(String key, @Nullable E value) {
    if (!enabled.get() || value == null) {
      return;
    }

    @SuppressWarnings("unchecked")
    var struct = (Struct<E>) STRUCT_REGISTRY.getEnumStruct(value.getDeclaringClass());
    if (struct.getSize() == 0) {
      log(key, value.toString());
      return;
    }
    prepareKey(key);
    Telemetry.log(key, value, struct);
  }

  /** Log an enum array. */
  public static <E extends Enum<E>> void log(String key, @Nullable E[] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    @SuppressWarnings("unchecked")
    var struct =
        (Struct<E>)
            STRUCT_REGISTRY.getEnumStruct(
                (Class<? extends Enum<?>>) value.getClass().getComponentType());
    if (struct.getSize() == 0) {
      log(key, Arrays.stream(value).map(Enum::toString).toArray(String[]::new));
      return;
    }
    prepareKey(key);
    Telemetry.log(key, value, struct);
  }

  /** Log a float. */
  public static void log(String key, float value) {
    if (!enabled.get()) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a float with unit metadata. */
  public static void log(String key, float value, @Nullable String unit) {
    if (unit == null) {
      log(key, value);
      return;
    }
    if (!enabled.get()) {
      return;
    }

    prepareKey(key);
    setUnit(key, unit);
    Telemetry.log(key, value);
  }

  /** Log a float array. */
  public static void log(String key, float @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a float array with unit metadata. */
  public static void log(String key, float @Nullable [] value, @Nullable String unit) {
    if (unit == null) {
      log(key, value);
      return;
    }
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    setUnit(key, unit);
    Telemetry.log(key, value);
  }

  /** Log an int array. */
  public static void log(String key, int @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a long. */
  public static void log(String key, long value) {
    if (!enabled.get()) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a long with unit metadata. */
  public static void log(String key, long value, @Nullable String unit) {
    if (unit == null) {
      log(key, value);
      return;
    }
    if (!enabled.get()) {
      return;
    }

    prepareKey(key);
    setUnit(key, unit);
    Telemetry.log(key, value);
  }

  // TODO: Raw logs

  /** Log a long array. */
  public static void log(String key, long @Nullable [] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a long array with unit metadata. */
  public static void log(String key, long @Nullable [] value, @Nullable String unit) {
    if (unit == null) {
      log(key, value);
      return;
    }
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    setUnit(key, unit);
    Telemetry.log(key, value);
  }

  /** Log a record. */
  public static void log(String key, @Nullable Record value) {
    if (!enabled.get() || value == null) {
      return;
    }

    // WPILib's concrete measure types are records, and javac crashes if we add a
    // log(String, Measure) overload, so handle them at runtime here.
    if (value instanceof Measure<?> measure) {
      prepareKey(key);
      Telemetry.log(key, measure);
      return;
    }

    @SuppressWarnings("unchecked")
    var struct = (Struct<Record>) STRUCT_REGISTRY.getRecordStruct(value.getClass());
    prepareKey(key);
    Telemetry.log(key, value, struct);
  }

  /** Log a record array. */
  public static void log(String key, @Nullable Record[] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    @SuppressWarnings("unchecked")
    var struct =
        (Struct<Record>)
            STRUCT_REGISTRY.getRecordStruct(
                (Class<? extends Record>) value.getClass().getComponentType());
    prepareKey(key);
    Telemetry.log(key, value, struct);
  }

  /** Log a string. */
  public static void log(String key, @Nullable String value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a string with a custom type string. */
  public static void log(String key, @Nullable String value, @Nullable String customTypeString) {
    if (customTypeString == null) {
      log(key, value);
      return;
    }
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value, customTypeString);
  }

  /** Log a string array. */
  public static void log(String key, @Nullable String[] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a struct or protobuf. Struct is preferred, with protobuf used as a fallback. */
  public static <T extends WPISerializable> void log(String key, @Nullable T value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
  }

  /** Log a struct array. */
  public static <T extends StructSerializable> void log(String key, @Nullable T[] value) {
    if (!enabled.get() || value == null) {
      return;
    }

    prepareKey(key);
    Telemetry.log(key, value);
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
      FaultLogger.addFault(faultName, alertLevel);
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
      DataLogManager.logConsoleOutput(newOptions.captureConsole());
      if (newOptions.captureDs()) {
        DriverStation.startDataLog(DataLogManager.getLog());
      }
      EXTRAS.setOptions(newOptions);
      TUNABLE_MANAGER.setOptions(newOptions);
      log("DogLog/Options", newOptions.toString());
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
    EXTRAS.setPdh(pdh);
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
   * Stop a timer started with {@link #time(String)} and log the duration in seconds to the
   * specified key.
   *
   * @param key The key to stop the timer for.
   * @see DogLog#time(String)
   */
  public static void timeEnd(String key) {
    epochLogger.timeEnd(key, HALUtil.getMonotonicTime());
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
   * @return The tunable value.
   */
  public static TunableBoolean tunable(String key, boolean defaultValue) {
    return tunable(key, defaultValue, null);
  }

  /**
   * Create a tunable boolean.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableBoolean tunable(
      String key, boolean defaultValue, @Nullable BooleanConsumer onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, onChange);
  }

  /**
   * Create a tunable double.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return The tunable value.
   */
  public static TunableDouble tunable(String key, double defaultValue) {
    return tunable(key, defaultValue, (DoubleConsumer) null);
  }

  /**
   * Create a tunable double.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableDouble tunable(
      String key, double defaultValue, @Nullable DoubleConsumer onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, null, onChange);
  }

  /**
   * Create a tunable double with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return The tunable value.
   */
  public static TunableDouble tunable(String key, double defaultValue, @Nullable String unit) {
    return tunable(key, defaultValue, unit, (DoubleConsumer) null);
  }

  /**
   * Create a tunable double with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableDouble tunable(
      String key, double defaultValue, @Nullable String unit, @Nullable DoubleConsumer onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, unit, onChange);
  }

  /**
   * Create a tunable double with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return The tunable value.
   */
  public static TunableDouble tunable(String key, double defaultValue, @Nullable Unit unit) {
    return tunable(key, defaultValue, unit, (DoubleConsumer) null);
  }

  /**
   * Create a tunable double with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableDouble tunable(
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
   * @return The tunable value.
   */
  public static Tunable<double[]> tunable(String key, double[] defaultValue) {
    return tunable(key, defaultValue, (Consumer<double[]>) null);
  }

  /**
   * Create a tunable double array.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static Tunable<double[]> tunable(
      String key, double[] defaultValue, @Nullable Consumer<double[]> onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, null, onChange);
  }

  /**
   * Create a tunable double array with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return The tunable value.
   */
  public static Tunable<double[]> tunable(
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
   * @return The tunable value.
   */
  public static Tunable<double[]> tunable(
      String key,
      double[] defaultValue,
      @Nullable String unit,
      @Nullable Consumer<double[]> onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, unit, onChange);
  }

  /**
   * Create a tunable double array with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return The tunable value.
   */
  public static Tunable<double[]> tunable(String key, double[] defaultValue, @Nullable Unit unit) {
    return tunable(key, defaultValue, unit, (Consumer<double[]>) null);
  }

  /**
   * Create a tunable double array with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static Tunable<double[]> tunable(
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
   * @return The tunable value.
   */
  public static TunableFloat tunable(String key, float defaultValue) {
    return tunable(key, defaultValue, (FloatConsumer) null);
  }

  /**
   * Create a tunable float.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableFloat tunable(
      String key, float defaultValue, @Nullable FloatConsumer onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, null, onChange);
  }

  /**
   * Create a tunable float with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return The tunable value.
   */
  public static TunableFloat tunable(String key, float defaultValue, @Nullable String unit) {
    return tunable(key, defaultValue, unit, (FloatConsumer) null);
  }

  /**
   * Create a tunable float with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableFloat tunable(
      String key, float defaultValue, @Nullable String unit, @Nullable FloatConsumer onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, unit, onChange);
  }

  /**
   * Create a tunable float with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return The tunable value.
   */
  public static TunableFloat tunable(String key, float defaultValue, @Nullable Unit unit) {
    return tunable(key, defaultValue, unit, (FloatConsumer) null);
  }

  /**
   * Create a tunable float with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableFloat tunable(
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
   * @return The tunable value.
   */
  public static TunableLong tunable(String key, long defaultValue) {
    return tunable(key, defaultValue, (LongConsumer) null);
  }

  /**
   * Create a tunable integer.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableLong tunable(
      String key, long defaultValue, @Nullable LongConsumer onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, null, onChange);
  }

  /**
   * Create a tunable integer with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return The tunable value.
   */
  public static TunableLong tunable(String key, long defaultValue, @Nullable String unit) {
    return tunable(key, defaultValue, unit, (LongConsumer) null);
  }

  /**
   * Create a tunable integer with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableLong tunable(
      String key, long defaultValue, @Nullable String unit, @Nullable LongConsumer onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, unit, onChange);
  }

  /**
   * Create a tunable integer with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @return The tunable value.
   */
  public static TunableLong tunable(String key, long defaultValue, @Nullable Unit unit) {
    return tunable(key, defaultValue, unit, (LongConsumer) null);
  }

  /**
   * Create a tunable integer with unit metadata.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param unit The unit for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static TunableLong tunable(
      String key, long defaultValue, @Nullable Unit unit, @Nullable LongConsumer onChange) {
    if (unit == null) {
      return tunable(key, defaultValue, onChange);
    }
    return tunable(key, defaultValue, unit.name(), onChange);
  }

  /**
   * Create a tunable from a measure, preserving the user-specified unit.
   *
   * @param <M> The concrete measure type.
   * @param key The key for the tunable value.
   * @param defaultValue The default measure value for the tunable value.
   * @return The tunable value.
   */
  public static <M extends Measure<?>> Tunable<M> tunable(String key, M defaultValue) {
    // WPILib Measure is immutable, but its interface is not annotated @ThreadSafe.
    // @infer-ignore INTERFACE_NOT_THREAD_SAFE
    return tunable(key, defaultValue, null);
  }

  /**
   * Create a tunable from a measure, preserving the user-specified unit.
   *
   * @param <M> The concrete measure type.
   * @param key The key for the tunable value.
   * @param defaultValue The default measure value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static <M extends Measure<?>> Tunable<M> tunable(
      String key, M defaultValue, @Nullable Consumer<M> onChange) {
    // WPILib Measure is immutable, but its interface is not annotated @ThreadSafe.
    // @infer-ignore INTERFACE_NOT_THREAD_SAFE
    return TUNABLE_MANAGER.create(key, defaultValue, onChange);
  }

  /**
   * Create a tunable string.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @return The tunable value.
   */
  public static Tunable<String> tunable(String key, String defaultValue) {
    return tunable(key, defaultValue, null);
  }

  /**
   * Create a tunable string.
   *
   * @param key The key for the tunable value.
   * @param defaultValue The default value for the tunable value.
   * @param onChange A function to call when the tunable value changes.
   * @return The tunable value.
   */
  public static Tunable<String> tunable(
      String key, String defaultValue, @Nullable Consumer<String> onChange) {
    return TUNABLE_MANAGER.create(key, defaultValue, onChange);
  }

  private static void prepareKey(String key) {
    SOURCED_KEYS.computeIfAbsent(
        key,
        sourcedKey -> {
          Telemetry.setProperty(sourcedKey, "source", "\"DogLog\"");
          return Boolean.TRUE;
        });
  }

  private static void setUnit(String key, String unit) {
    Telemetry.setProperty(key, "unit", UnitTelemetry.getUnitMetadata(unit));
  }

  protected DogLog() {}
}
