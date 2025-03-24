// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.tunable.entry;

import edu.wpi.first.networktables.BooleanSubscriber;
import edu.wpi.first.networktables.BooleanTopic;
import edu.wpi.first.networktables.TimestampedBoolean;
import java.util.function.BooleanSupplier;

public class ToggleableBooleanSubscriber implements BooleanSubscriber {
  private final BooleanSubscriber subscriber;
  private final BooleanSupplier useNt;
  private final boolean defaultValue;

  public ToggleableBooleanSubscriber(
      BooleanSubscriber subscriber, boolean defaultValue, BooleanSupplier useNt) {
    this.subscriber = subscriber;
    this.useNt = useNt;
    this.defaultValue = defaultValue;
  }

  @Override
  public BooleanTopic getTopic() {
    return subscriber.getTopic();
  }

  @Override
  public boolean get() {
    if (useNt.getAsBoolean()) {
      return subscriber.get();
    }

    return defaultValue;
  }

  @Override
  public boolean get(boolean defaultValue) {
    if (useNt.getAsBoolean()) {
      return subscriber.get(defaultValue);
    }

    return defaultValue;
  }

  @Override
  public TimestampedBoolean getAtomic() {
    return subscriber.getAtomic();
  }

  @Override
  public TimestampedBoolean[] readQueue() {
    return subscriber.readQueue();
  }

  @Override
  public TimestampedBoolean getAtomic(boolean defaultValue) {
    return subscriber.getAtomic(defaultValue);
  }

  @Override
  public boolean[] readQueueValues() {
    return subscriber.readQueueValues();
  }

  @Override
  public boolean exists() {
    return subscriber.exists();
  }

  @Override
  public long getLastChange() {
    return getLastChange();
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
