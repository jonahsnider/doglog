package dev.doglog.internal.reporters;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.StructRegistry;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;

public class CombinedReporter {
  /** The NetworkTables table to log to, if NetworkTables publishing is enabled. */
  private static final String LOG_TABLE = "/Robot";

  private final DataLogReporter dataLogReporter;
  // Default to null
  private NetworkTablesReporter ntReporter;

  private DogLogOptions options = new DogLogOptions();

  public CombinedReporter(DogLogOptions initialOptions) {
    dataLogReporter = new DataLogReporter(LOG_TABLE, initialOptions);

    setOptions(initialOptions);
  }

  public void log(long timestamp, String key, boolean[] value) {
    if (value == null) {
      return;
    }

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
    if (value == null) {
      return;
    }

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

  public void log(long timestamp, String key, float[] value) {
    if (value == null) {
      return;
    }

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

  public void log(long timestamp, String key, long[] value) {
    if (value == null) {
      return;
    }

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

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value);
    }
  }

  public void log(long timestamp, String key, String value) {
    if (value == null) {
      return;
    }

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

    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, value, customTypeString);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, value, customTypeString);
    }
  }

  private <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, struct, value);

    checkNtPublish();
    if (ntReporter != null) {
      ntReporter.log(timestamp, key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(long timestamp, String key, T[] value) {
    if (value == null) {
      return;
    }

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
    if (value == null) {
      return;
    }

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
        ntReporter = new NetworkTablesReporter(LOG_TABLE);
      }
    } else if (ntReporter != null) {
      ntReporter.close();
      ntReporter = null;
    }
  }
}
