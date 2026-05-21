package dev.doglog.internal.tunable.on_change;

import org.jspecify.annotations.NullMarked;
import org.wpilib.util.function.FloatConsumer;

@NullMarked
public record FloatOnChange(FloatConsumer onChange, float defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
