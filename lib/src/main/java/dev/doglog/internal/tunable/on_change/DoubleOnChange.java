package dev.doglog.internal.tunable.on_change;

import java.util.function.DoubleConsumer;
import org.jspecify.annotations.NullMarked;

@NullMarked
public record DoubleOnChange(DoubleConsumer onChange, double defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
