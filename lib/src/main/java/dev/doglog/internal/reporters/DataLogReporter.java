package dev.doglog.internal.reporters;

import dev.doglog.DogLogOptions;
import edu.wpi.first.datalog.BooleanArrayLogEntry;
import edu.wpi.first.datalog.BooleanLogEntry;
import edu.wpi.first.datalog.DataLog;
import edu.wpi.first.datalog.DoubleArrayLogEntry;
import edu.wpi.first.datalog.DoubleLogEntry;
import edu.wpi.first.datalog.FloatArrayLogEntry;
import edu.wpi.first.datalog.FloatLogEntry;
import edu.wpi.first.datalog.IntegerArrayLogEntry;
import edu.wpi.first.datalog.IntegerLogEntry;
import edu.wpi.first.datalog.StringArrayLogEntry;
import edu.wpi.first.datalog.StringLogEntry;
import edu.wpi.first.datalog.StructArrayLogEntry;
import edu.wpi.first.datalog.StructLogEntry;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.DriverStation;
import java.util.HashMap;
import java.util.Map;

/** Logs to a WPILib {@link DataLog}. */
public class DataLogReporter implements Reporter {
  private static final String ENTRY_METADATA = "{\"source\":\"DogLog\"}";

  private final Map<String, BooleanArrayLogEntry> booleanArrayLogs = new HashMap<>();
  private final Map<String, BooleanLogEntry> booleanLogs = new HashMap<>();
  private final Map<String, DoubleArrayLogEntry> doubleArrayLogs = new HashMap<>();
  private final Map<String, DoubleLogEntry> doubleLogs = new HashMap<>();
  private final Map<String, FloatArrayLogEntry> floatArrayLogs = new HashMap<>();
  private final Map<String, FloatLogEntry> floatLogs = new HashMap<>();
  private final Map<String, IntegerArrayLogEntry> integerArrayLogs = new HashMap<>();
  private final Map<String, IntegerLogEntry> integerLogs = new HashMap<>();
  private final Map<String, StringArrayLogEntry> stringArrayLogs = new HashMap<>();
  private final Map<String, StringLogEntry> stringLogs = new HashMap<>();
  private final Map<String, StructArrayLogEntry<?>> structArrayLogs = new HashMap<>();
  private final Map<String, StructLogEntry<?>> structLogs = new HashMap<>();

  private final DataLog log;
  private int alertNtLogHandle = -1;

  private final String logTable;

  public DataLogReporter(String logTable, DogLogOptions initialOptions) {
    this.logTable = logTable;

    setOptions(initialOptions);
    // Do this after setting options to control when NT capture starts
    log = DataLogManager.getLog();

    // Capture tunable changes to the DataLog directly
    // This is a special case since we don't want to re-log to NT
    NetworkTableInstance.getDefault()
        .startEntryDataLog(DataLogManager.getLog(), "/Tunable/", "Robot/Tunable/");
  }

  @Override
  public void log(long timestamp, String key, boolean[] value) {
    booleanArrayLogs
        .computeIfAbsent(
            key, k -> new BooleanArrayLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, boolean value) {
    booleanLogs
        .computeIfAbsent(
            key, k -> new BooleanLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, double[] value) {
    doubleArrayLogs
        .computeIfAbsent(
            key, k -> new DoubleArrayLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, double value) {
    doubleLogs
        .computeIfAbsent(key, k -> new DoubleLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, float[] value) {
    floatArrayLogs
        .computeIfAbsent(
            key, k -> new FloatArrayLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, float value) {
    floatLogs
        .computeIfAbsent(key, k -> new FloatLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, long[] value) {
    integerArrayLogs
        .computeIfAbsent(
            key, k -> new IntegerArrayLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, long value) {
    integerLogs
        .computeIfAbsent(
            key, k -> new IntegerLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  // TODO: Raw logs

  @Override
  public void log(long timestamp, String key, String[] value) {
    stringArrayLogs
        .computeIfAbsent(
            key, k -> new StringArrayLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, String value) {
    stringLogs
        .computeIfAbsent(key, k -> new StringLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, String value, String customTypeString) {
    stringLogs
        .computeIfAbsent(
            key,
            k -> new StringLogEntry(log, prefixKey(k), ENTRY_METADATA, customTypeString, timestamp))
        .update(value, timestamp);
  }

  @Override
  public <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {
    @SuppressWarnings("unchecked")
    var entry =
        (StructArrayLogEntry<T>)
            structArrayLogs.computeIfAbsent(
                key,
                k ->
                    StructArrayLogEntry.create(
                        log, prefixKey(k), struct, ENTRY_METADATA, timestamp));

    entry.update(value, timestamp);
  }

  @Override
  public <T> void log(long timestamp, String key, Struct<T> struct, T value) {
    @SuppressWarnings("unchecked")
    var entry =
        (StructLogEntry<T>)
            structLogs.computeIfAbsent(
                key,
                k -> StructLogEntry.create(log, prefixKey(k), struct, ENTRY_METADATA, timestamp));

    entry.update(value, timestamp);
  }

  public void setOptions(DogLogOptions options) {
    DataLogManager.logNetworkTables(options.captureNt());

    DataLogManager.logConsoleOutput(options.captureConsole());

    if (options.captureDs()) {
      DriverStation.startDataLog(DataLogManager.getLog());
    }

    if (options.logExtras()) {
      if (alertNtLogHandle == -1) {
        alertNtLogHandle =
            NetworkTableInstance.getDefault()
                .startEntryDataLog(
                    DataLogManager.getLog(), "/SmartDashboard/Alerts/", "Robot/Alerts/");
      }
    } else if (alertNtLogHandle != -1) {
      NetworkTableInstance.stopEntryDataLog(alertNtLogHandle);
      alertNtLogHandle = -1;
    }
  }

  private String prefixKey(String key) {
    return logTable + "/" + key;
  }
}
