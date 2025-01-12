// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.reporters;

import dev.doglog.DogLogOptions;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.util.datalog.BooleanArrayLogEntry;
import edu.wpi.first.util.datalog.BooleanLogEntry;
import edu.wpi.first.util.datalog.DataLog;
import edu.wpi.first.util.datalog.DoubleArrayLogEntry;
import edu.wpi.first.util.datalog.DoubleLogEntry;
import edu.wpi.first.util.datalog.FloatArrayLogEntry;
import edu.wpi.first.util.datalog.FloatLogEntry;
import edu.wpi.first.util.datalog.IntegerArrayLogEntry;
import edu.wpi.first.util.datalog.IntegerLogEntry;
import edu.wpi.first.util.datalog.RawLogEntry;
import edu.wpi.first.util.datalog.StringArrayLogEntry;
import edu.wpi.first.util.datalog.StringLogEntry;
import edu.wpi.first.util.datalog.StructArrayLogEntry;
import edu.wpi.first.util.datalog.StructLogEntry;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotBase;
import edu.wpi.first.wpilibj.RuntimeType;
import java.util.HashMap;
import java.util.Map;

/** Logs to a WPILib {@link DataLog}. */
public class DataLogReporter implements Reporter {
  /** The directory path when logging to the flash storage on a roboRIO 1. */
  private static final String RIO1_DISK_LOG_DIR = "/home/lvuser/logs";

  private final Map<String, BooleanArrayLogEntry> booleanArrayLogs = new HashMap<>();
  private final Map<String, BooleanLogEntry> booleanLogs = new HashMap<>();
  private final Map<String, DoubleArrayLogEntry> doubleArrayLogs = new HashMap<>();
  private final Map<String, DoubleLogEntry> doubleLogs = new HashMap<>();
  private final Map<String, FloatArrayLogEntry> floatArrayLogs = new HashMap<>();
  private final Map<String, FloatLogEntry> floatLogs = new HashMap<>();
  private final Map<String, IntegerArrayLogEntry> integerArrayLogs = new HashMap<>();
  private final Map<String, IntegerLogEntry> integerLogs = new HashMap<>();
  private final Map<String, RawLogEntry> rawLogs = new HashMap<>();
  private final Map<String, StringArrayLogEntry> stringArrayLogs = new HashMap<>();
  private final Map<String, StringLogEntry> stringLogs = new HashMap<>();
  private final Map<String, StructArrayLogEntry<?>> structArrayLogs = new HashMap<>();
  private final Map<String, StructLogEntry<?>> structLogs = new HashMap<>();

  private final DataLog log = DataLogManager.getLog();

  private int alertNtLogHandle = -1;

  private final String logTable;

  public DataLogReporter(String logTable, DogLogOptions initialOptions) {
    this.logTable = logTable;

    setOptions(initialOptions);
  }

  @Override
  public void log(long timestamp, String key, boolean[] value) {
    booleanArrayLogs
        .computeIfAbsent(key, k -> new BooleanArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, boolean value) {
    booleanLogs
        .computeIfAbsent(key, k -> new BooleanLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, double[] value) {
    doubleArrayLogs
        .computeIfAbsent(key, k -> new DoubleArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, double value) {
    doubleLogs
        .computeIfAbsent(key, k -> new DoubleLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, float[] value) {
    floatArrayLogs
        .computeIfAbsent(key, k -> new FloatArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, float value) {
    floatLogs
        .computeIfAbsent(key, k -> new FloatLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, long[] value) {
    integerArrayLogs
        .computeIfAbsent(key, k -> new IntegerArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, long value) {
    integerLogs
        .computeIfAbsent(key, k -> new IntegerLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  // TODO: Raw logs

  @Override
  public void log(long timestamp, String key, String[] value) {
    stringArrayLogs
        .computeIfAbsent(key, k -> new StringArrayLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, String value) {
    stringLogs
        .computeIfAbsent(key, k -> new StringLogEntry(log, prefixKey(k)))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, String value, String customTypeString) {
    stringLogs
        .computeIfAbsent(key, k -> new StringLogEntry(log, prefixKey(k), "", customTypeString))
        .update(value, timestamp);
  }

  @Override
  public <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {
    @SuppressWarnings("unchecked")
    var entry =
        (StructArrayLogEntry<T>)
            structArrayLogs.computeIfAbsent(
                key, k -> StructArrayLogEntry.create(log, prefixKey(k), struct));

    entry.update(value, timestamp);
  }

  @Override
  public <T> void log(long timestamp, String key, Struct<T> struct, T value) {
    @SuppressWarnings("unchecked")
    var entry =
        (StructLogEntry<T>)
            structLogs.computeIfAbsent(key, k -> StructLogEntry.create(log, prefixKey(k), struct));

    entry.update(value, timestamp);
  }

  public void setOptions(DogLogOptions options) {
    DataLogManager.logConsoleOutput(options.captureConsole());

    DataLogManager.logNetworkTables(options.captureNt());

    if (options.captureDs()) {
      DriverStation.startDataLog(log);
    }

    if (options.logExtras()) {
      if (alertNtLogHandle == -1) {
        alertNtLogHandle =
            NetworkTableInstance.getDefault()
                .startEntryDataLog(log, "/SmartDashboard/Alerts/", "Robot/Alerts/");
      }
    } else if (alertNtLogHandle != -1) {
      NetworkTableInstance.stopEntryDataLog(alertNtLogHandle);
      alertNtLogHandle = -1;
    }
  }

  /**
   * This could be a static method, but it's not because this class controls initializing {@link
   * DataLogManager}, which has to be done before this method can be called.
   *
   * @return Whether the log destination directory is valid. On a roboRIO 2 this is always true, on
   *     a roboRIO 1 this is true when a USB drive is attached.
   */
  public boolean isLogDestinationValid() {
    // See DataLogManager#makeLogDir() for source on this logic
    return !(RobotBase.getRuntimeType() == RuntimeType.kRoboRIO
        && DataLogManager.getLogDir().equals(RIO1_DISK_LOG_DIR));
  }

  private String prefixKey(String key) {
    return logTable + "/" + key;
  }
}
