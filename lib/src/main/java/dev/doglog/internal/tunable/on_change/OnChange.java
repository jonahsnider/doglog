package dev.doglog.internal.tunable.on_change;

import java.util.function.Consumer;
import org.jspecify.annotations.NullMarked;

@NullMarked
public record OnChange<T>(Consumer<T> onChange, T defaultValue) {
  public void acceptDefault() {
    onChange.accept(defaultValue);
  }
}
