// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.reporters;

import edu.wpi.first.networktables.BooleanArrayPublisher;
import edu.wpi.first.networktables.BooleanPublisher;
import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.FloatArrayPublisher;
import edu.wpi.first.networktables.FloatPublisher;
import edu.wpi.first.networktables.GenericPublisher;
import edu.wpi.first.networktables.IntegerArrayPublisher;
import edu.wpi.first.networktables.IntegerPublisher;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.PubSubOption;
import edu.wpi.first.networktables.RawPublisher;
import edu.wpi.first.networktables.StringArrayPublisher;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.networktables.StructArrayPublisher;
import edu.wpi.first.networktables.StructPublisher;
import edu.wpi.first.util.struct.Struct;
import java.util.HashMap;
import java.util.Map;

/** Logs to NetworkTables. */
public class NetworkTablesReporter implements AutoCloseable, Reporter {
  private static final PubSubOption PUB_SUB_OPTIONS = PubSubOption.sendAll(true);

  private final NetworkTable logTable;

  private final Map<String, BooleanArrayPublisher> booleanArrayPublishers = new HashMap<>();
  private final Map<String, BooleanPublisher> booleanPublishers = new HashMap<>();
  private final Map<String, DoubleArrayPublisher> doubleArrayPublishers = new HashMap<>();
  private final Map<String, DoublePublisher> doublePublishers = new HashMap<>();
  private final Map<String, FloatArrayPublisher> floatArrayPublishers = new HashMap<>();
  private final Map<String, FloatPublisher> floatPublishers = new HashMap<>();
  private final Map<String, IntegerArrayPublisher> integerArrayPublishers = new HashMap<>();
  private final Map<String, IntegerPublisher> integerPublishers = new HashMap<>();
  private final Map<String, RawPublisher> rawPublishers = new HashMap<>();
  private final Map<String, StringArrayPublisher> stringArrayPublishers = new HashMap<>();
  private final Map<String, StringPublisher> stringPublishers = new HashMap<>();
  private final Map<String, GenericPublisher> customStringPublishers = new HashMap<>();
  private final Map<String, StructArrayPublisher<?>> structArrayPublishers = new HashMap<>();
  private final Map<String, StructPublisher<?>> structPublishers = new HashMap<>();

  public NetworkTablesReporter(String logTable) {
    this.logTable = NetworkTableInstance.getDefault().getTable(logTable);
  }

  @Override
  public void log(long timestamp, String key, boolean[] value) {
    booleanArrayPublishers
        .computeIfAbsent(key, k -> logTable.getBooleanArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, boolean value) {
    booleanPublishers
        .computeIfAbsent(key, k -> logTable.getBooleanTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, double[] value) {
    doubleArrayPublishers
        .computeIfAbsent(key, k -> logTable.getDoubleArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, double value) {
    doublePublishers
        .computeIfAbsent(key, k -> logTable.getDoubleTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, float[] value) {
    floatArrayPublishers
        .computeIfAbsent(key, k -> logTable.getFloatArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, float value) {
    floatPublishers
        .computeIfAbsent(key, k -> logTable.getFloatTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, long[] value) {
    integerArrayPublishers
        .computeIfAbsent(key, k -> logTable.getIntegerArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, long value) {
    integerPublishers
        .computeIfAbsent(key, k -> logTable.getIntegerTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  // TODO: Raw logs

  @Override
  public void log(long timestamp, String key, String[] value) {
    stringArrayPublishers
        .computeIfAbsent(key, k -> logTable.getStringArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, String value) {
    stringPublishers
        .computeIfAbsent(key, k -> logTable.getStringTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value, timestamp);
  }

  @Override
  public void log(long timestamp, String key, String value, String customTypeString) {
    customStringPublishers
        .computeIfAbsent(
            key, k -> logTable.getTopic(k).genericPublish(customTypeString, PUB_SUB_OPTIONS))
        .setString(value, timestamp);
  }

  @Override
  public <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {
    @SuppressWarnings("unchecked")
    var publisher =
        (StructArrayPublisher<T>)
            structArrayPublishers.computeIfAbsent(
                key, k -> logTable.getStructArrayTopic(k, struct).publish(PUB_SUB_OPTIONS));
    publisher.set(value, timestamp);
  }

  @Override
  public <T> void log(long timestamp, String key, Struct<T> struct, T value) {
    @SuppressWarnings("unchecked")
    var publisher =
        (StructPublisher<T>)
            structPublishers.computeIfAbsent(
                key, k -> logTable.getStructTopic(k, struct).publish(PUB_SUB_OPTIONS));
    publisher.set(value, timestamp);
  }

  @Override
  public void close() {
    // Close all publishers stored in the maps
    for (var publisher : booleanArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : booleanPublishers.values()) {
      publisher.close();
    }
    for (var publisher : doubleArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : doublePublishers.values()) {
      publisher.close();
    }
    for (var publisher : floatArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : floatPublishers.values()) {
      publisher.close();
    }
    for (var publisher : integerArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : integerPublishers.values()) {
      publisher.close();
    }
    for (var publisher : rawPublishers.values()) {
      publisher.close();
    }
    for (var publisher : stringArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : stringPublishers.values()) {
      publisher.close();
    }
    for (var publisher : structArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : structPublishers.values()) {
      publisher.close();
    }
  }
}
