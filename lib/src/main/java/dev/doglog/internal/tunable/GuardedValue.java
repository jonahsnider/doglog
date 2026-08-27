package dev.doglog.internal.tunable;

import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import java.util.function.UnaryOperator;
import org.jspecify.annotations.NullMarked;

/** Stores a tunable value while applying DogLog's dynamic enable policy. */
@NullMarked
final class GuardedValue<T> {
  private final UnaryOperator<T> copy;
  private final T defaultValue;
  private final BooleanSupplier enabled;
  private final AtomicReference<T> value;

  GuardedValue(T defaultValue, UnaryOperator<T> copy, BooleanSupplier enabled) {
    this.copy = copy;
    this.defaultValue = copy.apply(defaultValue);
    this.enabled = enabled;
    value = new AtomicReference<>(copy.apply(defaultValue));
  }

  T get() {
    return copy.apply(enabled.getAsBoolean() ? value.get() : defaultValue);
  }

  void set(T newValue) {
    if (enabled.getAsBoolean()) {
      value.set(copy.apply(newValue));
    }
  }
}
