package dev.doglog.internal.log_thread.writers;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.writers.LogWriterLowLevel;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.util.datalog.BooleanArrayLogEntry;
import edu.wpi.first.util.datalog.BooleanLogEntry;
import edu.wpi.first.util.datalog.DataLog;
import edu.wpi.first.util.datalog.DataLogEntry;
import edu.wpi.first.util.datalog.DoubleArrayLogEntry;
import edu.wpi.first.util.datalog.DoubleLogEntry;
import edu.wpi.first.util.datalog.FloatArrayLogEntry;
import edu.wpi.first.util.datalog.FloatLogEntry;
import edu.wpi.first.util.datalog.IntegerArrayLogEntry;
import edu.wpi.first.util.datalog.IntegerLogEntry;
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
import org.jspecify.annotations.NullMarked;

/** Logs to a WPILib {@link DataLog}. */
@NullMarked
public class DataLogWriter implements LogWriterLowLevel {
  private static final String ENTRY_METADATA = "{\"source\":\"DogLog\"}";
  private static final String ENTRY_METADATA_UNITS_PREFIX = "{\"source\":\"DogLog\",\"unit\":\"";
  private static final String ENTRY_METADATA_UNITS_SUFFIX = "\"}";

  /** The directory path when logging to the flash storage on a roboRIO 1. */
  private static final String RIO1_DISK_LOG_DIR = "/home/lvuser/logs";

  private static String entryMetadataForUnit(String unit) {
    return ENTRY_METADATA_UNITS_PREFIX + unit + ENTRY_METADATA_UNITS_SUFFIX;
  }

  /**
   * Updates the metadata of an entry with a unit associated. This is to minimize calls to
   * DataLogManager to update entry metadata.
   */
  private static void updateUnitForEntry(
      long timestamp, Map<String, String> unitCache, String key, String unit, DataLogEntry entry) {
    // If we've never seen this key before, the current unit will be null
    var currentUnit = unitCache.get(key);
    if (unit.equals(currentUnit)) {
      return;
    }

    entry.setMetadata(entryMetadataForUnit(unit), timestamp);
    unitCache.put(key, unit);
  }

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

  /** Maps keys of double entries to their units. */
  private final Map<String, String> doubleUnits = new HashMap<>();

  private final Map<String, String> doubleArrayUnits = new HashMap<>();
  private final Map<String, String> floatUnits = new HashMap<>();
  private final Map<String, String> floatArrayUnits = new HashMap<>();
  private final Map<String, String> integerUnits = new HashMap<>();
  private final Map<String, String> integerArrayUnits = new HashMap<>();

  private final DataLog log;
  private int alertNtLogHandle = -1;

  private final String logTable;

  public DataLogWriter(String logTable, DogLogOptions initialOptions) {
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
  public void log(long timestamp, String key, double[] value, String unit) {
    DoubleArrayLogEntry entry =
        doubleArrayLogs.computeIfAbsent(
            key,
            k -> new DoubleArrayLogEntry(log, prefixKey(k), entryMetadataForUnit(unit), timestamp));

    entry.update(value, timestamp);

    updateUnitForEntry(timestamp, doubleArrayUnits, key, unit, entry);
  }

  @Override
  public void log(long timestamp, String key, double value) {
    doubleLogs
        .computeIfAbsent(key, k -> new DoubleLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, double value, String unit) {
    DoubleLogEntry entry =
        doubleLogs.computeIfAbsent(
            key, k -> new DoubleLogEntry(log, prefixKey(k), entryMetadataForUnit(unit), timestamp));

    entry.update(value, timestamp);

    updateUnitForEntry(timestamp, doubleUnits, key, unit, entry);
  }

  @Override
  public void log(long timestamp, String key, float[] value) {
    floatArrayLogs
        .computeIfAbsent(
            key, k -> new FloatArrayLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, float[] value, String unit) {
    var entry =
        floatArrayLogs.computeIfAbsent(
            key,
            k -> new FloatArrayLogEntry(log, prefixKey(k), entryMetadataForUnit(unit), timestamp));

    entry.update(value, timestamp);

    updateUnitForEntry(timestamp, floatArrayUnits, key, unit, entry);
  }

  @Override
  public void log(long timestamp, String key, float value) {
    floatLogs
        .computeIfAbsent(key, k -> new FloatLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, float value, String unit) {
    var entry =
        floatLogs.computeIfAbsent(
            key, k -> new FloatLogEntry(log, prefixKey(k), entryMetadataForUnit(unit), timestamp));

    entry.update(value, timestamp);

    updateUnitForEntry(timestamp, floatUnits, key, unit, entry);
  }

  @Override
  public void log(long timestamp, String key, long[] value) {
    integerArrayLogs
        .computeIfAbsent(
            key, k -> new IntegerArrayLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, long[] value, String unit) {
    var entry =
        integerArrayLogs.computeIfAbsent(
            key,
            k ->
                new IntegerArrayLogEntry(log, prefixKey(k), entryMetadataForUnit(unit), timestamp));

    entry.update(value, timestamp);

    updateUnitForEntry(timestamp, integerArrayUnits, key, unit, entry);
  }

  @Override
  public void log(long timestamp, String key, long value) {
    integerLogs
        .computeIfAbsent(
            key, k -> new IntegerLogEntry(log, prefixKey(k), ENTRY_METADATA, timestamp))
        .update(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, long value, String unit) {
    var entry =
        integerLogs.computeIfAbsent(
            key,
            k -> new IntegerLogEntry(log, prefixKey(k), entryMetadataForUnit(unit), timestamp));

    entry.update(value, timestamp);

    updateUnitForEntry(timestamp, integerUnits, key, unit, entry);
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
