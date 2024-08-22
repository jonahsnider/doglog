// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.reporters;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.log_thread.StructRegistry;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.DataLogManager;

public class CombinedReporter {
  /** The NetworkTables table to log to, if NetworkTables publishing is enabled. */
  private static final String LOG_TABLE = "/Robot";

  private final DataLogReporter dataLogReporter =
      new DataLogReporter(DataLogManager.getLog(), LOG_TABLE);
  // Default to null
  private NetworkTablesReporter ntReporter;

  public CombinedReporter(DogLogOptions initialOptions) {
    // Setup NT publisher if initial options have it enabled
    if (initialOptions.ntPublish()) {
      ntReporter = new NetworkTablesReporter(LOG_TABLE);
    }

    // Print default options on start
    printOptions(initialOptions);
  }

  public void log(long timestamp, String key, boolean[] value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, value);

    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, boolean value) {
    dataLogReporter.log(timestamp, key, value);

    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, double[] value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, value);

    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, double value) {
    dataLogReporter.log(timestamp, key, value);

    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, float[] value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, value);

    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, float value) {
    dataLogReporter.log(timestamp, key, value);

    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, long[] value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, value);

    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, long value) {
    dataLogReporter.log(timestamp, key, value);
    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, value);
    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, Enum<?>[] value) {
    if (value == null) {
      return;
    }

    // Convert enum array to string array
    var stringArray = new String[value.length];

    for (int i = 0; i < value.length; i++) {
      stringArray[i] = value[i].name();
    }

    log(timestamp, key, stringArray);
  }

  public void log(long timestamp, String key, String value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, value);

    if (ntReporter != null) {
      ntReporter.log(key, value);
    }
  }

  public void log(long timestamp, String key, Enum<?> value) {
    if (value == null) {
      return;
    }

    log(timestamp, key, value.name());
  }

  private <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {
    if (value == null) {
      return;
    }

    dataLogReporter.log(timestamp, key, struct, value);
    if (ntReporter != null) {
      ntReporter.log(key, struct, value);
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
    if (ntReporter != null) {
      ntReporter.log(key, struct, value);
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
    // Avoid recreating the logger if the options haven't changed
    if (options.ntPublish() && ntReporter == null) {
      ntReporter = new NetworkTablesReporter(LOG_TABLE);
    } else {
      ntReporter = null;
    }

    printOptions(options);
  }

  private void printOptions(DogLogOptions options) {
    var now = HALUtil.getFPGATime();
    log(now, "DogLog/Options", options.toString());
  }
}
