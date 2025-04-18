package dev.doglog.internal.tunable.entry;

import edu.wpi.first.networktables.IntegerSubscriber;
import edu.wpi.first.networktables.IntegerTopic;
import edu.wpi.first.networktables.TimestampedInteger;
import java.util.function.BooleanSupplier;

public class ToggleableIntegerSubscriber implements IntegerSubscriber {
  private final IntegerSubscriber subscriber;
  private final BooleanSupplier useNt;
  private final long defaultValue;

  public ToggleableIntegerSubscriber(
      IntegerSubscriber subscriber, long defaultValue, BooleanSupplier useNt) {
    this.subscriber = subscriber;
    this.useNt = useNt;
    this.defaultValue = defaultValue;
  }

  @Override
  public IntegerTopic getTopic() {
    return subscriber.getTopic();
  }

  @Override
  public long get() {
    if (useNt.getAsBoolean()) {
      return subscriber.get();
    }

    return defaultValue;
  }

  @Override
  public long get(long defaultValue) {
    if (useNt.getAsBoolean()) {
      return subscriber.get(defaultValue);
    }

    return defaultValue;
  }

  @Override
  public TimestampedInteger getAtomic() {
    return subscriber.getAtomic();
  }

  @Override
  public TimestampedInteger getAtomic(long defaultValue) {
    return subscriber.getAtomic(defaultValue);
  }

  @Override
  public TimestampedInteger[] readQueue() {
    return subscriber.readQueue();
  }

  @Override
  public long[] readQueueValues() {
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
