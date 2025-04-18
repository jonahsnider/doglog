package dev.doglog.internal.tunable.entry;

import edu.wpi.first.networktables.StringSubscriber;
import edu.wpi.first.networktables.StringTopic;
import edu.wpi.first.networktables.TimestampedString;
import java.util.function.BooleanSupplier;

public class ToggleableStringSubscriber implements StringSubscriber {
  private final StringSubscriber subscriber;
  private final BooleanSupplier useNt;
  private final String defaultValue;

  public ToggleableStringSubscriber(
      StringSubscriber subscriber, String defaultValue, BooleanSupplier useNt) {
    this.subscriber = subscriber;
    this.useNt = useNt;
    this.defaultValue = defaultValue;
  }

  @Override
  public StringTopic getTopic() {
    return subscriber.getTopic();
  }

  @Override
  public String get() {
    if (useNt.getAsBoolean()) {
      return subscriber.get();
    }

    return defaultValue;
  }

  @Override
  public String get(String defaultValue) {
    if (useNt.getAsBoolean()) {
      return subscriber.get(defaultValue);
    }

    return defaultValue;
  }

  @Override
  public TimestampedString getAtomic() {
    return subscriber.getAtomic();
  }

  @Override
  public TimestampedString getAtomic(String defaultValue) {
    return subscriber.getAtomic(defaultValue);
  }

  @Override
  public TimestampedString[] readQueue() {
    return subscriber.readQueue();
  }

  @Override
  public String[] readQueueValues() {
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
