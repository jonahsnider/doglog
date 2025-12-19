package dev.doglog.internal.tunable.on_change;

import java.util.function.LongConsumer;
import org.jspecify.annotations.NullMarked;

@NullMarked
public record LongOnChange(LongConsumer onChange, long defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
