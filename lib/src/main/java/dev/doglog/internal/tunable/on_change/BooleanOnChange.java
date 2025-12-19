package dev.doglog.internal.tunable.on_change;

import edu.wpi.first.util.function.BooleanConsumer;
import org.jspecify.annotations.NullMarked;

@NullMarked
public record BooleanOnChange(BooleanConsumer onChange, boolean defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
