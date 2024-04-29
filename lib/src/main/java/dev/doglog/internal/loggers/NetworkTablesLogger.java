// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.loggers;

import edu.wpi.first.networktables.BooleanArrayPublisher;
import edu.wpi.first.networktables.BooleanPublisher;
import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.FloatArrayPublisher;
import edu.wpi.first.networktables.FloatPublisher;
import edu.wpi.first.networktables.IntegerArrayPublisher;
import edu.wpi.first.networktables.IntegerPublisher;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.ProtobufPublisher;
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
public class NetworkTablesLogger implements LogConsumer {
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
  private final Map<String, ProtobufPublisher<?>> protobufPublishers = new HashMap<>();
  private final Map<String, RawPublisher> rawPublishers = new HashMap<>();
  private final Map<String, StringArrayPublisher> stringArrayPublishers = new HashMap<>();
  private final Map<String, StringPublisher> stringPublishers = new HashMap<>();
  private final Map<String, StructArrayPublisher<?>> structArrayPublishers = new HashMap<>();
  private final Map<String, StructPublisher<?>> structPublishers = new HashMap<>();

  public NetworkTablesLogger(String logTable) {
    this.logTable = NetworkTableInstance.getDefault().getTable(logTable);
  }

  @SuppressWarnings("resource")
  public void log(String key, boolean[] value) {
    booleanArrayPublishers
        .computeIfAbsent(key, k -> logTable.getBooleanArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  @SuppressWarnings("resource")
  public void log(String key, boolean value) {
    booleanPublishers
        .computeIfAbsent(key, k -> logTable.getBooleanTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  @SuppressWarnings("resource")
  public void log(String key, double[] value) {
    doubleArrayPublishers
        .computeIfAbsent(key, k -> logTable.getDoubleArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  @SuppressWarnings("resource")
  public void log(String key, double value) {
    doublePublishers
        .computeIfAbsent(key, k -> logTable.getDoubleTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  @SuppressWarnings("resource")
  public void log(String key, float[] value) {
    floatArrayPublishers
        .computeIfAbsent(key, k -> logTable.getFloatArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  @SuppressWarnings("resource")
  public void log(String key, float value) {
    floatPublishers
        .computeIfAbsent(key, k -> logTable.getFloatTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  public void log(String key, int[] value) {
    log(key, value);
  }

  @SuppressWarnings("resource")
  public void log(String key, long[] value) {
    integerArrayPublishers
        .computeIfAbsent(key, k -> logTable.getIntegerArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  @SuppressWarnings("resource")
  public void log(String key, int value) {
    integerPublishers
        .computeIfAbsent(key, k -> logTable.getIntegerTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  @SuppressWarnings("resource")
  public void log(String key, String[] value) {
    if (value == null) {
      return;
    }

    stringArrayPublishers
        .computeIfAbsent(key, k -> logTable.getStringArrayTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  @SuppressWarnings("resource")
  public void log(String key, String value) {
    if (value == null) {
      return;
    }

    stringPublishers
        .computeIfAbsent(key, k -> logTable.getStringTopic(k).publish(PUB_SUB_OPTIONS))
        .set(value);
  }

  @SuppressWarnings("resource")
  public <T> void log(String key, Struct<T> struct, T[] value) {
    if (struct == null || value == null) {
      return;
    }

    @SuppressWarnings("unchecked")
    var publisher =
        (StructArrayPublisher<T>)
            structArrayPublishers.computeIfAbsent(
                key, k -> logTable.getStructArrayTopic(k, struct).publish(PUB_SUB_OPTIONS));
    publisher.set(value);
  }

  @SuppressWarnings("resource")
  public <T> void log(String key, Struct<T> struct, T value) {
    if (struct == null || value == null) {
      return;
    }

    @SuppressWarnings("unchecked")
    var publisher =
        (StructPublisher<T>)
            structPublishers.computeIfAbsent(
                key, k -> logTable.getStructTopic(k, struct).publish(PUB_SUB_OPTIONS));
    publisher.set(value);
  }
}
