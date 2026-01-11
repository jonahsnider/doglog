package dev.doglog.internal.log_thread.writers;

import dev.doglog.DogLog;
import dev.doglog.DogLogOptions;
import dev.doglog.internal.NtPublishRegistry;
import dev.doglog.internal.log_thread.LogThread;
import dev.doglog.internal.log_thread.StructRegistry;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.Alert.AlertType;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;

@NullMarked
public class CombinedWriter {
  /** The NetworkTables table to log to, if NetworkTables publishing is enabled. */
  private static final String LOG_TABLE = "/Robot";

  private final DataLogWriter dataLogReporter;
  // Default to null
  private @Nullable NetworkTablesWriter ntReporter;

  private DogLogOptions options = new DogLogOptions();

  private final StructRegistry structRegistry = new StructRegistry();

  public CombinedWriter(DogLogOptions initialOptions) {
    dataLogReporter = new DataLogWriter(LOG_TABLE, initialOptions);

    setOptions(initialOptions);
  }

  public void log(long timestamp, String key, boolean[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, boolean value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, double[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, double value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, double value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, float[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, float value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, float value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, long[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, long value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, double[] value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, float[] value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, long[] value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, long value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, String value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, String value, String customTypeString) {
    dataLogReporter.log(timestamp, key, value, customTypeString);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, value, customTypeString);
    }
  }

  private <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {
    dataLogReporter.log(timestamp, key, struct, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(long timestamp, String key, T[] value) {
    @SuppressWarnings("unchecked")
    var maybeStruct =
        structRegistry.getStruct((@NonNull Class<T>) value.getClass().getComponentType());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (@NonNull Struct<T>) maybeStruct.orElseThrow();
      log(timestamp, key, struct, value);
    }
  }

  private <T> void log(long timestamp, String key, Struct<T> struct, T value) {
    dataLogReporter.log(timestamp, key, struct, value);

    checkNtPublish();
    if (ntReporter != null && shouldPublishToNt(key)) {
      ntReporter.log(timestamp, key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(long timestamp, String key, T value) {
    var maybeStruct =
        structRegistry.getStruct((@NonNull Class<? extends StructSerializable>) value.getClass());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (@NonNull Struct<T>) maybeStruct.orElseThrow();
      log(timestamp, key, struct, value);
    }
  }

  @SuppressWarnings("unchecked")
  public <E extends Enum<E>> void log(long timestamp, String key, E value) {
    var struct =
        (Struct<E>) structRegistry.getEnumStruct((@NonNull Class<E>) value.getDeclaringClass());

    log(timestamp, key, struct, value);
  }

  @SuppressWarnings("unchecked")
  public <E extends Enum<E>> void log(long timestamp, String key, E[] value) {
    var struct =
        (@NonNull Struct<E>)
            structRegistry.getEnumStruct((@NonNull Class<E>) value.getClass().getComponentType());

    log(timestamp, key, struct, value);
  }

  @SuppressWarnings("unchecked")
  public <R extends Record> void log(long timestamp, String key, R value) {
    var struct = (@NonNull Struct<R>) structRegistry.getRecordStruct(value.getClass());

    log(timestamp, key, struct, value);
  }

  @SuppressWarnings("unchecked")
  public <R extends Record> void log(long timestamp, String key, R[] value) {
    var struct =
        (@NonNull Struct<R>)
            structRegistry.getRecordStruct(
                (Class<? extends Record>) value.getClass().getComponentType());

    log(timestamp, key, struct, value);
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
    log(now, "DogLog/Options", options.toString());
  }

  private void checkNtPublish() {
    // Avoid recreating the logger if the options haven't changed
    if (options.ntPublish().getAsBoolean()) {
      if (ntReporter == null) {
        ntReporter = new NetworkTablesWriter(LOG_TABLE);
      }
    } else if (ntReporter != null) {
      ntReporter.close();
      ntReporter = null;
    }
  }

  private boolean shouldPublishToNt(String key) {
    return switch (options.ntPublishMode()) {
      case ALL -> true;
      case MARKED_ONLY -> NtPublishRegistry.isMarked(key);
    };
  }
}
