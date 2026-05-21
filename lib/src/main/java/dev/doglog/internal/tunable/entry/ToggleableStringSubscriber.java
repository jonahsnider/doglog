package dev.doglog.internal.tunable.entry;

import java.util.function.BooleanSupplier;
import org.jspecify.annotations.NullMarked;
import org.wpilib.networktables.StringSubscriber;
import org.wpilib.networktables.StringTopic;
import org.wpilib.networktables.TimestampedString;

@NullMarked
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
  public void close() {
    subscriber.close();
  }

  @Override
  public boolean exists() {
    return subscriber.exists();
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
  public int getHandle() {
    return subscriber.getHandle();
  }

  @Override
  public long getLastChange() {
    return subscriber.getLastChange();
  }

  @Override
  public StringTopic getTopic() {
    return subscriber.getTopic();
  }

  @Override
  public boolean isValid() {
    return subscriber.isValid();
  }

  @Override
  public TimestampedString[] readQueue() {
    return subscriber.readQueue();
  }

  @Override
  public String[] readQueueValues() {
    return subscriber.readQueueValues();
  }
}
