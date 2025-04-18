package dev.doglog.internal.tunable.on_change;

import edu.wpi.first.util.function.BooleanConsumer;

public record BooleanOnChange(BooleanConsumer onChange, boolean defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
