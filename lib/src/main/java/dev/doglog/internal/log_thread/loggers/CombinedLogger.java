// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.loggers;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.log_thread.StructRegistry;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.DataLogManager;

public class CombinedLogger {
  /** The NetworkTables table to log to, if NetworkTables publishing is enabled. */
  private static final String LOG_TABLE = "/Robot";

  private final DataLogLogger dataLogLogger = new DataLogLogger(DataLogManager.getLog(), LOG_TABLE);
  // Default to null
  private NetworkTablesLogger ntLogger;

  public CombinedLogger(DogLogOptions initialOptions) {
    // Print default options on start
    printOptions(initialOptions);
  }

  public void log(long timestamp, String key, boolean[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(timestamp, key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(long timestamp, String key, boolean value) {
    dataLogLogger.log(timestamp, key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(long timestamp, String key, double[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(timestamp, key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(long timestamp, String key, double value) {
    dataLogLogger.log(timestamp, key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(long timestamp, String key, float[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(timestamp, key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(long timestamp, String key, float value) {
    dataLogLogger.log(timestamp, key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(long timestamp, String key, long[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(timestamp, key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(long timestamp, String key, long value) {
    dataLogLogger.log(timestamp, key, value);
    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(timestamp, key, value);
    if (ntLogger != null) {
      ntLogger.log(key, value);
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

    dataLogLogger.log(timestamp, key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
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

    dataLogLogger.log(timestamp, key, struct, value);
    if (ntLogger != null) {
      ntLogger.log(key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(long timestamp, String key, T[] value) {
    if (value == null) {
      return;
    }

    var maybeStruct = StructRegistry.findStructType(value.getClass().getComponentType());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (Struct<T>) maybeStruct.get();
      log(timestamp, key, struct, value);
    }
  }

  private <T> void log(long timestamp, String key, Struct<T> struct, T value) {
    dataLogLogger.log(timestamp, key, struct, value);
    if (ntLogger != null) {
      ntLogger.log(key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(long timestamp, String key, T value) {
    if (value == null) {
      return;
    }

    var maybeStruct = StructRegistry.findStructType(value.getClass());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (Struct<T>) maybeStruct.get();
      log(timestamp, key, struct, value);
    }
  }

  public void setOptions(DogLogOptions options) {
    // Avoid recreating the logger if the options haven't changed
    if (options.ntPublish() && ntLogger == null) {
      ntLogger = new NetworkTablesLogger(LOG_TABLE);
    } else {
      ntLogger = null;
    }

    printOptions(options);
  }

  private void printOptions(DogLogOptions options) {
    var now = HALUtil.getFPGATime();
    log(now, "DogLog/Options", options.toString());
  }
}
