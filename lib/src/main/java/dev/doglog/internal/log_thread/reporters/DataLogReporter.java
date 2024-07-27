// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.reporters;

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
import java.util.HashMap;
import java.util.Map;

/** Logs to a WPILib {@link DataLog}. */
public class DataLogReporter {
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

  private final String logTable;

  private final DataLog log;

  public DataLogReporter(DataLog log, String logTable) {
    this.log = log;
    this.logTable = logTable;
  }

  public void log(long timestamp, String key, boolean[] value) {
    booleanArrayLogs
        .computeIfAbsent(key, k -> new BooleanArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public void log(long timestamp, String key, boolean value) {
    booleanLogs
        .computeIfAbsent(key, k -> new BooleanLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public void log(long timestamp, String key, double[] value) {
    doubleArrayLogs
        .computeIfAbsent(key, k -> new DoubleArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public void log(long timestamp, String key, double value) {
    doubleLogs
        .computeIfAbsent(key, k -> new DoubleLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public void log(long timestamp, String key, float[] value) {
    floatArrayLogs
        .computeIfAbsent(key, k -> new FloatArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public void log(long timestamp, String key, float value) {
    floatLogs
        .computeIfAbsent(key, k -> new FloatLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public void log(long timestamp, String key, long[] value) {
    integerArrayLogs
        .computeIfAbsent(key, k -> new IntegerArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public void log(long timestamp, String key, long value) {
    integerLogs
        .computeIfAbsent(key, k -> new IntegerLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  public void log(long timestamp, String key, String[] value) {
    stringArrayLogs
        .computeIfAbsent(key, k -> new StringArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public void log(long timestamp, String key, String value) {
    stringLogs
        .computeIfAbsent(key, k -> new StringLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  public <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {

    @SuppressWarnings("unchecked")
    var entry =
        (StructArrayLogEntry<T>)
            structArrayLogs.computeIfAbsent(
                key, k -> StructArrayLogEntry.create(log, prefixKey(k), struct));

    entry.update(value, timestamp);
  }

  public <T> void log(long timestamp, String key, Struct<T> struct, T value) {
    @SuppressWarnings("unchecked")
    var entry =
        (StructLogEntry<T>)
            structLogs.computeIfAbsent(key, k -> StructLogEntry.create(log, prefixKey(k), struct));

    entry.update(value, timestamp);
  }

  private String prefixKey(String key) {
    return logTable + "/" + key;
  }
}
