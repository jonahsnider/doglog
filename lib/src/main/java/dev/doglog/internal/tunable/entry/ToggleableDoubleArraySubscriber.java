package dev.doglog.internal.tunable.entry;

import edu.wpi.first.networktables.DoubleArraySubscriber;
import edu.wpi.first.networktables.DoubleArrayTopic;
import edu.wpi.first.networktables.TimestampedDoubleArray;
import java.util.function.BooleanSupplier;
import org.jspecify.annotations.NullMarked;

@NullMarked
public class ToggleableDoubleArraySubscriber implements DoubleArraySubscriber {
  private final DoubleArraySubscriber subscriber;
  private final BooleanSupplier useNt;
  private final double[] defaultValue;

  public ToggleableDoubleArraySubscriber(
      DoubleArraySubscriber subscriber, double[] defaultValue, BooleanSupplier useNt) {
    this.subscriber = subscriber;
    this.useNt = useNt;
    this.defaultValue = defaultValue;
  }

  @Override
  public DoubleArrayTopic getTopic() {
    return subscriber.getTopic();
  }

  @Override
  public double[] get() {
    if (useNt.getAsBoolean()) {
      return subscriber.get();
    }

    return defaultValue;
  }

  @Override
  public double[] get(double[] defaultValue) {
    if (useNt.getAsBoolean()) {
      return subscriber.get(defaultValue);
    }

    return defaultValue;
  }

  @Override
  public TimestampedDoubleArray getAtomic() {
    return subscriber.getAtomic();
  }

  @Override
  public TimestampedDoubleArray getAtomic(double[] defaultValue) {
    return subscriber.getAtomic(defaultValue);
  }

  @Override
  public TimestampedDoubleArray[] readQueue() {
    return subscriber.readQueue();
  }

  @Override
  public double[][] readQueueValues() {
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
