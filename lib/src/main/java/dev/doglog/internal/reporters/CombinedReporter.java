// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.reporters;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.StructRegistry;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.DataLogManager;
import java.util.Arrays;

public class CombinedReporter implements BaseReporter {
  /** The NetworkTables table to log to, if NetworkTables publishing is enabled. */
  private static final String LOG_TABLE = "/Robot";

  private final InternalReporter dataLogLogger =
      new DataLogReporter(DataLogManager.getLog(), LOG_TABLE);
  // Default to null
  private InternalReporter ntLogger;

  public CombinedReporter(DogLogOptions initialOptions) {
    // Print default options on start
    printOptions(initialOptions);
  }

  public void log(String key, boolean[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, boolean value) {
    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, double[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, double value) {
    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, float[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, float value) {
    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, int[] value) {
    if (value == null) {
      return;
    }

    log(key, Arrays.stream(value).asLongStream().toArray());
  }

  public void log(String key, long[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, long value) {
    dataLogLogger.log(key, value);
    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  public void log(String key, String[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(key, value);
    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, Enum<?>[] value) {
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

  public void log(String key, String value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, Enum<?> value) {
    if (value == null) {
      return;
    }

    log(key, value.name());
  }

  private <T> void log(String key, Struct<T> struct, T[] value) {
    if (value == null) {
      return;
    }

    dataLogLogger.log(key, struct, value);
    if (ntLogger != null) {
      ntLogger.log(key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(String key, T[] value) {
    if (value == null) {
      return;
    }

    var maybeStruct = StructRegistry.findStructType(value.getClass().getComponentType());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (Struct<T>) maybeStruct.get();
      log(key, struct, value);
    }
  }

  private <T> void log(String key, Struct<T> struct, T value) {
    dataLogLogger.log(key, struct, value);
    if (ntLogger != null) {
      ntLogger.log(key, struct, value);
    }
  }

  public <T extends StructSerializable> void log(String key, T value) {
    if (value == null) {
      return;
    }

    var maybeStruct = StructRegistry.findStructType(value.getClass());

    if (maybeStruct.isPresent()) {
      @SuppressWarnings("unchecked")
      var struct = (Struct<T>) maybeStruct.get();
      log(key, struct, value);
    }
  }

  public void setOptions(DogLogOptions options) {
    // Avoid recreating the logger if the options haven't changed
    if (options.ntPublish() && ntLogger == null) {
      ntLogger = new NetworkTablesReporter(LOG_TABLE);
    } else {
      ntLogger = null;
    }

    printOptions(options);
  }

  private void printOptions(DogLogOptions options) {
    log("DogLog/Options", options.toString());
  }
}
