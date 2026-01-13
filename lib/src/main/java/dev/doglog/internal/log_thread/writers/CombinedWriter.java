package dev.doglog.internal.log_thread.writers;

import dev.doglog.DogLog;
import dev.doglog.DogLogOptions;
import dev.doglog.internal.log_thread.LogThread;
import dev.doglog.internal.log_thread.StructRegistry;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.Alert.AlertType;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.NullMarked;

@NullMarked
public class CombinedWriter {
  /** The NetworkTables table to log to, if NetworkTables publishing is enabled. */
  private static final String LOG_TABLE = "/Robot";

  private final DataLogWriter dataLogReporter;
  private final NetworkTablesWriter ntReporter = new NetworkTablesWriter(LOG_TABLE);

  private DogLogOptions options = new DogLogOptions();

  private final StructRegistry structRegistry = new StructRegistry();

  public CombinedWriter(DogLogOptions initialOptions) {
    dataLogReporter = new DataLogWriter(LOG_TABLE, initialOptions);

    setOptions(initialOptions);
  }

  public void log(long timestamp, String key, boolean forceNt, boolean[] value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, boolean value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, double[] value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, double value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, double value, String unit) {
    dataLogReporter.log(timestamp, key, false, value, unit);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value, unit);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, float[] value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, float value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, float value, String unit) {
    dataLogReporter.log(timestamp, key, false, value, unit);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value, unit);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, long[] value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, long value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, double[] value, String unit) {
    dataLogReporter.log(timestamp, key, false, value, unit);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value, unit);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, float[] value, String unit) {
    dataLogReporter.log(timestamp, key, false, value, unit);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value, unit);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, long[] value, String unit) {
    dataLogReporter.log(timestamp, key, false, value, unit);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value, unit);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, long value, String unit) {
    dataLogReporter.log(timestamp, key, false, value, unit);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value, unit);
    }
  }

  // TODO: Raw logs

  public void log(long timestamp, String key, boolean forceNt, String[] value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(long timestamp, String key, boolean forceNt, String value) {
    dataLogReporter.log(timestamp, key, false, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value);
    }
  }

  public void log(
      long timestamp, String key, boolean forceNt, String value, String customTypeString) {
    dataLogReporter.log(timestamp, key, false, value, customTypeString);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, value, customTypeString);
    }
  }

  private <T> void log(long timestamp, String key, boolean forceNt, Struct<T> struct, T[] value) {
    dataLogReporter.log(timestamp, key, false, struct, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, struct, value);
    }
  }

  public <T extends StructSerializable> void log(
      long timestamp, String key, boolean forceNt, T[] value) {
    @SuppressWarnings("unchecked")
    var maybeStruct =
        structRegistry.getStruct((@NonNull Class<T>) value.getClass().getComponentType());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (@NonNull Struct<T>) maybeStruct.orElseThrow();
      log(timestamp, key, forceNt, struct, value);
    }
  }

  private <T> void log(long timestamp, String key, boolean forceNt, Struct<T> struct, T value) {
    dataLogReporter.log(timestamp, key, false, struct, value);

    if (forceNt || options.ntPublish().getAsBoolean()) {
      ntReporter.log(timestamp, key, false, struct, value);
    }
  }

  public <T extends StructSerializable> void log(
      long timestamp, String key, boolean forceNt, T value) {
    var maybeStruct =
        structRegistry.getStruct((@NonNull Class<? extends StructSerializable>) value.getClass());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (@NonNull Struct<T>) maybeStruct.orElseThrow();
      log(timestamp, key, forceNt, struct, value);
    }
  }

  @SuppressWarnings("unchecked")
  public <E extends Enum<E>> void log(long timestamp, String key, boolean forceNt, E value) {
    var struct =
        (Struct<E>) structRegistry.getEnumStruct((@NonNull Class<E>) value.getDeclaringClass());

    log(timestamp, key, forceNt, struct, value);
  }

  @SuppressWarnings("unchecked")
  public <E extends Enum<E>> void log(long timestamp, String key, boolean forceNt, E[] value) {
    var struct =
        (@NonNull Struct<E>)
            structRegistry.getEnumStruct((@NonNull Class<E>) value.getClass().getComponentType());

    log(timestamp, key, forceNt, struct, value);
  }

  @SuppressWarnings("unchecked")
  public <R extends Record> void log(long timestamp, String key, boolean forceNt, R value) {
    var struct = (@NonNull Struct<R>) structRegistry.getRecordStruct(value.getClass());

    log(timestamp, key, forceNt, struct, value);
  }

  @SuppressWarnings("unchecked")
  public <R extends Record> void log(long timestamp, String key, boolean forceNt, R[] value) {
    var struct =
        (@NonNull Struct<R>)
            structRegistry.getRecordStruct(
                (Class<? extends Record>) value.getClass().getComponentType());

    log(timestamp, key, forceNt, struct, value);
  }

  public void setOptions(DogLogOptions options) {
    this.options = options;

    dataLogReporter.setOptions(options);

    printOptions();
  }

  /**
   * Runs code that may produce logs, and thus must be run once all DogLog init logic has been run.
   * Using the {@link LogThread} start for this is a convenient way to run code at that point.
   */
  public void afterLogThreadStart() {
    if (!dataLogReporter.isLogDestinationValid()) {
      DogLog.logFault("[DogLog] UNSAFE_LOG_DESTINATION", AlertType.kWarning);
    }
  }

  private void printOptions() {
    var now = HALUtil.getFPGATime();
    log(now, "DogLog/Options", false, options.toString());
  }
}
