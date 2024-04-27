// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.loggers;

import dev.doglog.StructRegistry;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;

public class DogLogLogger implements ExtendedLogConsumer {
  private final DataLogLogger dataLogLogger;
  private final NetworkTablesLogger ntLogger;

  public void log(String key, boolean[] value) {
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
    log(key, value);
  }

  public void log(String key, long[] value) {
    dataLogLogger.log(key, value);

    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  public void log(String key, int value) {
    dataLogLogger.log(key, value);
    if (ntLogger != null) {
      ntLogger.log(key, value);
    }
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  public void log(String key, String[] value) {
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

  public <T> void log(String key, Struct<T> struct, T[] value) {
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

  public <T> void log(String key, Struct<T> struct, T value) {
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

  public DogLogLogger(DataLogLogger dataLogLogger, NetworkTablesLogger ntLogger) {
    this.dataLogLogger = dataLogLogger;
    this.ntLogger = ntLogger;
  }
}
