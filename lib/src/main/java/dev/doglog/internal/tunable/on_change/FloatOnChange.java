package dev.doglog.internal.tunable.on_change;

import edu.wpi.first.util.function.FloatConsumer;

public record FloatOnChange(FloatConsumer onChange, float defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
