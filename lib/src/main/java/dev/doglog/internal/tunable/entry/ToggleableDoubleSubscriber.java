package dev.doglog.internal.tunable.entry;

import edu.wpi.first.networktables.DoubleSubscriber;
import edu.wpi.first.networktables.DoubleTopic;
import edu.wpi.first.networktables.TimestampedDouble;
import java.util.function.BooleanSupplier;

public class ToggleableDoubleSubscriber implements DoubleSubscriber {
  private final DoubleSubscriber subscriber;
  private final BooleanSupplier useNt;
  private final double defaultValue;

  public ToggleableDoubleSubscriber(
      DoubleSubscriber subscriber, double defaultValue, BooleanSupplier useNt) {
    this.subscriber = subscriber;
    this.useNt = useNt;
    this.defaultValue = defaultValue;
  }

  @Override
  public DoubleTopic getTopic() {
    return subscriber.getTopic();
  }

  @Override
  public double get() {
    if (useNt.getAsBoolean()) {
      return subscriber.get();
    }

    return defaultValue;
  }

  @Override
  public double get(double defaultValue) {
    if (useNt.getAsBoolean()) {
      return subscriber.get(defaultValue);
    }

    return defaultValue;
  }

  @Override
  public TimestampedDouble getAtomic() {
    return subscriber.getAtomic();
  }

  @Override
  public TimestampedDouble getAtomic(double defaultValue) {
    return subscriber.getAtomic(defaultValue);
  }

  @Override
  public TimestampedDouble[] readQueue() {
    return subscriber.readQueue();
  }

  @Override
  public double[] readQueueValues() {
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
