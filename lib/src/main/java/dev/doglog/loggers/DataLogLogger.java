// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.loggers;

import edu.wpi.first.util.datalog.BooleanArrayLogEntry;
import edu.wpi.first.util.datalog.BooleanLogEntry;
import edu.wpi.first.util.datalog.DataLog;
import edu.wpi.first.util.datalog.DoubleArrayLogEntry;
import edu.wpi.first.util.datalog.DoubleLogEntry;
import edu.wpi.first.util.datalog.FloatArrayLogEntry;
import edu.wpi.first.util.datalog.FloatLogEntry;
import edu.wpi.first.util.datalog.IntegerArrayLogEntry;
import edu.wpi.first.util.datalog.IntegerLogEntry;
import edu.wpi.first.util.datalog.ProtobufLogEntry;
import edu.wpi.first.util.datalog.RawLogEntry;
import edu.wpi.first.util.datalog.StringArrayLogEntry;
import edu.wpi.first.util.datalog.StringLogEntry;
import edu.wpi.first.util.datalog.StructArrayLogEntry;
import edu.wpi.first.util.datalog.StructLogEntry;
import edu.wpi.first.util.struct.Struct;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/** Logs to a WPILib {@link DataLog}. */
public class DataLogLogger implements LogConsumer {
  private final Map<String, BooleanArrayLogEntry> booleanArrayLogs = new HashMap<>();
  private final Map<String, BooleanLogEntry> booleanLogs = new HashMap<>();
  private final Map<String, DoubleArrayLogEntry> doubleArrayLogs = new HashMap<>();
  private final Map<String, DoubleLogEntry> doubleLogs = new HashMap<>();
  private final Map<String, FloatArrayLogEntry> floatArrayLogs = new HashMap<>();
  private final Map<String, FloatLogEntry> floatLogs = new HashMap<>();
  private final Map<String, IntegerArrayLogEntry> integerArrayLogs = new HashMap<>();
  private final Map<String, IntegerLogEntry> integerLogs = new HashMap<>();
  private final Map<String, ProtobufLogEntry<?>> protobufLogs = new HashMap<>();
  private final Map<String, RawLogEntry> rawLogs = new HashMap<>();
  private final Map<String, StringArrayLogEntry> stringArrayLogs = new HashMap<>();
  private final Map<String, StringLogEntry> stringLogs = new HashMap<>();
  private final Map<String, StructArrayLogEntry<?>> structArrayLogs = new HashMap<>();
  private final Map<String, StructLogEntry<?>> structLogs = new HashMap<>();
  private final Map<String, Integer> valueHashes = new HashMap<>();

  private final String logTable;

  private final DataLog log;

  public DataLogLogger(DataLog log, String logTable) {
    this.log = log;
    this.logTable = logTable;
  }

  public void log(String key, boolean[] value) {
    var hash = Arrays.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      booleanArrayLogs
          .computeIfAbsent(key, k -> new BooleanArrayLogEntry(log, prefixKey(k)))
          .append(value);

      valueHashes.put(key, hash);
    }
  }

  public void log(String key, boolean value) {
    var hash = Boolean.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      booleanLogs.computeIfAbsent(key, k -> new BooleanLogEntry(log, prefixKey(k))).append(value);

      valueHashes.put(key, hash);
    }
  }

  public void log(String key, double[] value) {
    var hash = Arrays.hashCode(value);
    if (valueHashes.getOrDefault(key, 0) != hash) {
      doubleArrayLogs
          .computeIfAbsent(key, k -> new DoubleArrayLogEntry(log, prefixKey(k)))
          .append(value);

      valueHashes.put(key, hash);
    }
  }

  public void log(String key, double value) {
    var hash = Double.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      doubleLogs.computeIfAbsent(key, k -> new DoubleLogEntry(log, prefixKey(k))).append(value);

      valueHashes.put(key, hash);
    }
  }

  public void log(String key, float[] value) {
    var hash = Arrays.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      floatArrayLogs
          .computeIfAbsent(key, k -> new FloatArrayLogEntry(log, prefixKey(k)))
          .append(value);

      valueHashes.put(key, hash);
    }
  }

  public void log(String key, float value) {
    var hash = Float.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      floatLogs.computeIfAbsent(key, k -> new FloatLogEntry(log, prefixKey(k))).append(value);

      valueHashes.put(key, hash);
    }
  }

  public void log(String key, int[] value) {
    log(key, value);
  }

  public void log(String key, long[] value) {
    var hash = Arrays.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      integerArrayLogs
          .computeIfAbsent(key, k -> new IntegerArrayLogEntry(log, prefixKey(k)))
          .append(value);

      valueHashes.put(key, hash);
    }
  }

  public void log(String key, int value) {
    var hash = Integer.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      integerLogs.computeIfAbsent(key, k -> new IntegerLogEntry(log, prefixKey(k))).append(value);

      valueHashes.put(key, hash);
    }
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  public void log(String key, String[] value) {
    if (value == null) {
      return;
    }

    var hash = Arrays.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      stringArrayLogs
          .computeIfAbsent(key, k -> new StringArrayLogEntry(log, prefixKey(k)))
          .append(value);

      valueHashes.put(key, hash);
    }
  }

  public void log(String key, String value) {
    if (value == null) {
      return;
    }

    var hash = value.hashCode();

    if (valueHashes.getOrDefault(key, 0) != hash) {
      stringLogs.computeIfAbsent(key, k -> new StringLogEntry(log, prefixKey(k))).append(value);

      valueHashes.put(key, hash);
    }
  }

  public <T> void log(String key, Struct<T> struct, T[] value) {
    if (struct == null || value == null) {
      return;
    }

    var hash = Arrays.hashCode(value);

    if (valueHashes.getOrDefault(key, 0) != hash) {
      @SuppressWarnings("unchecked")
      var entry =
          (StructArrayLogEntry<T>)
              structArrayLogs.computeIfAbsent(
                  key, k -> StructArrayLogEntry.create(log, prefixKey(k), struct));

      entry.append(value);

      valueHashes.put(key, hash);
    }
  }

  public <T> void log(String key, Struct<T> struct, T value) {
    if (struct == null || value == null) {
      return;
    }

    var hash = value.hashCode();

    if (valueHashes.getOrDefault(key, 0) != hash) {
      @SuppressWarnings("unchecked")
      var entry =
          (StructLogEntry<T>)
              structLogs.computeIfAbsent(
                  key, k -> StructLogEntry.create(log, prefixKey(k), struct));

      entry.append(value);

      valueHashes.put(key, hash);
    }
  }

  private String prefixKey(String key) {
    return logTable + "/" + key;
  }
}
