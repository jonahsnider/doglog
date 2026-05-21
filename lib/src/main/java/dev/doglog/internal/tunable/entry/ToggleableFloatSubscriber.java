package dev.doglog.internal.tunable.entry;

import java.util.function.BooleanSupplier;
import org.jspecify.annotations.NullMarked;
import org.wpilib.networktables.FloatSubscriber;
import org.wpilib.networktables.FloatTopic;
import org.wpilib.networktables.TimestampedFloat;

@NullMarked
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
  public void close() {
    subscriber.close();
  }

  @Override
  public boolean exists() {
    return subscriber.exists();
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
  public TimestampedFloat getAtomic(float defaultValue) {
    return subscriber.getAtomic(defaultValue);
  }

  @Override
  public int getHandle() {
    return subscriber.getHandle();
  }

  @Override
  public long getLastChange() {
    return subscriber.getLastChange();
  }

  @Override
  public FloatTopic getTopic() {
    return subscriber.getTopic();
  }

  @Override
  public boolean isValid() {
    return subscriber.isValid();
  }

  @Override
  public TimestampedFloat[] readQueue() {
    return subscriber.readQueue();
  }

  @Override
  public float[] readQueueValues() {
    return subscriber.readQueueValues();
  }
}
