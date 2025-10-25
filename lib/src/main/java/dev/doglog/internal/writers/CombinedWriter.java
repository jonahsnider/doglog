package dev.doglog.internal.writers;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.StructRegistry;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;
import org.jspecify.annotations.Nullable;

public class CombinedWriter {
  /** The NetworkTables table to log to, if NetworkTables publishing is enabled. */
  private static final String LOG_TABLE = "/Robot";

  private final DataLogWriter dataLogReporter;
  // Default to null
  private @Nullable NetworkTablesWriter ntReporter;

  private DogLogOptions options = new DogLogOptions();

  public CombinedWriter(DogLogOptions initialOptions) {
    dataLogReporter = new DataLogWriter(LOG_TABLE, initialOptions);

    setOptions(initialOptions);
  }

  public void log(long timestamp, String key, boolean[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, boolean value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, double[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, double value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, double value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, float[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, float value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, float value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, long[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, long value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, double[] value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, float[] value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, long[] value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  public void log(long timestamp, String key, long value, String unit) {
    dataLogReporter.log(timestamp, key, value, unit);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value, unit);
    }
  }

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, String value) {
    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, String value, String customTypeString) {
    if (customTypeString == null) {
      log(timestamp, key, value);
      return;
    }

    dataLogReporter.log(timestamp, key, value, customTypeString);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value, customTypeString);
    }
  }

  private <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {
    dataLogReporter.log(timestamp, key, struct, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(long timestamp, String key, T[] value) {
    var maybeStruct = StructRegistry.getStruct(value.getClass().getComponentType());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (Struct<T>) maybeStruct.get();
      log(timestamp, key, struct, value);
    }
  }

  private <T> void log(long timestamp, String key, Struct<T> struct, T value) {
    dataLogReporter.log(timestamp, key, struct, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(long timestamp, String key, T value) {
    var maybeStruct = StructRegistry.getStruct(value.getClass());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (Struct<T>) maybeStruct.get();
      log(timestamp, key, struct, value);
    }
  }

  public void setOptions(DogLogOptions options) {
    this.options = options;

    dataLogReporter.setOptions(options);

    printOptions();
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
}
