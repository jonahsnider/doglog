// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.tunable.entry;

import edu.wpi.first.networktables.FloatSubscriber;
import edu.wpi.first.networktables.FloatTopic;
import edu.wpi.first.networktables.TimestampedFloat;
import java.util.function.BooleanSupplier;

public class ToggleableFloatSubscriber implements FloatSubscriber {
  private final FloatSubscriber subscriber;
  private final BooleanSupplier useNt;
  private final float defaultValue;

  public ToggleableFloatSubscriber(
      FloatSubscriber subscriber, float defaultValue, BooleanSupplier useNt) {
    this.subscriber = subscriber;
    this.useNt = useNt;
    this.defaultValue = defaultValue;
  }

  @Override
  public FloatTopic getTopic() {
    return subscriber.getTopic();
  }

  @Override
  public float get() {
    if (useNt.getAsBoolean()) {
      return subscriber.get();
    }

    return defaultValue;
  }

  @Override
  public float get(float defaultValue) {
    if (useNt.getAsBoolean()) {
      return subscriber.get(defaultValue);
    }

    return defaultValue;
  }

  @Override
  public TimestampedFloat getAtomic() {
    return subscriber.getAtomic();
  }

  @Override
  public TimestampedFloat[] readQueue() {
    return subscriber.readQueue();
  }

  @Override
  public TimestampedFloat getAtomic(float defaultValue) {
    return subscriber.getAtomic(defaultValue);
  }

  @Override
  public float[] readQueueValues() {
    return subscriber.readQueueValues();
  }

  @Override
  public boolean exists() {
    return subscriber.exists();
  }

  @Override
  public long getLastChange() {
    return subscriber.getLastChange();
  }

  @Override
  public void close() {
    subscriber.close();
  }

  @Override
  public boolean isValid() {
    return subscriber.isValid();
  }

  @Override
  public int getHandle() {
    return subscriber.getHandle();
  }
}
