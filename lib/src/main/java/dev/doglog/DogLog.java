// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

import dev.doglog.loggers.DataLogLogger;
import dev.doglog.loggers.DogLogLogger;
import dev.doglog.loggers.NetworkTablesLogger;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.DriverStation;

/** A logger based on WPILib's {@link DataLogManager} */
public class DogLog {
  protected static final String LOG_TABLE = "/Robot";

  protected static DogLogOptions options = new DogLogOptions();
  protected static DogLogLogger logger = createLogger();
  protected static boolean enabled = true;

  public static void setOptions(DogLogOptions newOptions) {
    if (newOptions == null) {
      newOptions = new DogLogOptions();
    }

    var oldOptions = options;
    options = newOptions;

    if (!oldOptions.equals(newOptions)) {
      System.out.println("[DogLog] Options changed: " + newOptions.toString());
      logger = createLogger();
    }
  }

  public static void setEnabled(boolean newEnabled) {
    enabled = newEnabled;
  }

  public static void log(String key, boolean[] value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, boolean value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, double[] value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, double value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, float[] value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, float value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, int[] value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, long[] value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, int value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  public static void log(String key, String[] value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, Enum<?>[] value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, String value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static void log(String key, Enum<?> value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static <T> void log(String key, Struct<T> struct, T[] value) {
    if (enabled) {
      logger.log(key, struct, value);
    }
  }

  public static <T extends StructSerializable> void log(String key, T[] value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  public static <T> void log(String key, Struct<T> struct, T value) {
    if (enabled) {
      logger.log(key, struct, value);
    }
  }

  public static <T extends StructSerializable> void log(String key, T value) {
    if (enabled) {
      logger.log(key, value);
    }
  }

  protected static DogLogLogger createLogger() {
    var log = DataLogManager.getLog();

    var newLogger =
        new DogLogLogger(
            new DataLogLogger(log, LOG_TABLE),
            options.ntPublish() ? new NetworkTablesLogger(LOG_TABLE) : null);

    DataLogManager.logNetworkTables(options.captureNt());

    if (options.captureDs()) {
      DriverStation.startDataLog(log);
    }

    return newLogger;
  }

  protected DogLog() {}
}
