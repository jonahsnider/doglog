package dev.doglog.internal.tunable.on_change;

import org.jspecify.annotations.NullMarked;
import org.wpilib.util.function.BooleanConsumer;

@NullMarked
public record BooleanOnChange(BooleanConsumer onChange, boolean defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
