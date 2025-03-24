// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.events;

import edu.wpi.first.util.struct.StructSerializable;

public class LogEvent {
  public long timestamp;
  public String key;
  public EventType type;
  // Disruptor doesn't allow multiple queues counting towards the same size bound, so we need to use
  // Object to make this a generic log event
  private Object value;

  public void set(String key, long timestamp, boolean[] value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.BOOLEAN_ARRAY;
  }

  public void set(String key, long timestamp, boolean value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.BOOLEAN;
  }

  public void set(String key, long timestamp, double[] value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.DOUBLE_ARRAY;
  }

  public void set(String key, long timestamp, double value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.DOUBLE;
  }

  public void set(String key, long timestamp, float[] value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.FLOAT_ARRAY;
  }

  public void set(String key, long timestamp, float value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.FLOAT;
  }

  public void set(String key, long timestamp, long[] value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.INTEGER_ARRAY;
  }

  public void set(String key, long timestamp, long value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.INTEGER;
  }

  public void set(String key, long timestamp, int[] value) {
    long[] longArray = new long[value.length];
    for (int i = 0; i < value.length; i++) {
      longArray[i] = value[i];
    }
    set(key, timestamp, longArray);
  }

  public void set(String key, long timestamp, int value) {
    set(key, timestamp, (long) value);
  }

  public void set(String key, long timestamp, String[] value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.STRING_ARRAY;
  }

  public void set(String key, long timestamp, String value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.STRING;
  }

  public void set(String key, long timestamp, String value, String customTypeString) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = new CustomTypeString(value, customTypeString);
    type = EventType.STRING_CUSTOM_TYPE;
  }

  public void set(String key, long timestamp, StructSerializable value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.STRUCT;
  }

  public void set(String key, long timestamp, StructSerializable[] value) {
    this.key = key;
    this.timestamp = timestamp;
    this.value = value;
    type = EventType.STRUCT_ARRAY;
  }

  public boolean[] getBooleanArray() {
    return (boolean[]) value;
  }

  public boolean getBoolean() {
    return (boolean) value;
  }

  public double[] getDoubleArray() {
    return (double[]) value;
  }

  public double getDouble() {
    return (double) value;
  }

  public float[] getFloatArray() {
    return (float[]) value;
  }

  public float getFloat() {
    return (float) value;
  }

  public long[] getIntegerArray() {
    return (long[]) value;
  }

  public long getInteger() {
    return (long) value;
  }

  public String[] getStringArray() {
    return (String[]) value;
  }

  public String getString() {
    return (String) value;
  }

  public CustomTypeString getCustomTypeString() {
    return (CustomTypeString) value;
  }

  public StructSerializable[] getStructArray() {
    return (StructSerializable[]) value;
  }

  public StructSerializable getStruct() {
    return (StructSerializable) value;
  }
}
