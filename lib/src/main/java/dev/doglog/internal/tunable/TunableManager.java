package dev.doglog.internal.tunable;

import com.google.errorprone.annotations.ThreadSafe;
import dev.doglog.DogLogOptions;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.LongConsumer;
import java.util.function.UnaryOperator;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.wpilib.internal.UnitTelemetry;
import org.wpilib.tunable.Tunable;
import org.wpilib.tunable.TunableBoolean;
import org.wpilib.tunable.TunableConfig;
import org.wpilib.tunable.TunableDouble;
import org.wpilib.tunable.TunableFloat;
import org.wpilib.tunable.TunableLong;
import org.wpilib.tunable.Tunables;
import org.wpilib.units.Measure;
import org.wpilib.util.function.BooleanConsumer;
import org.wpilib.util.function.FloatConsumer;

/** Applies DogLog's enable policy to WPILib tunables. */
@NullMarked
@ThreadSafe
public final class TunableManager {
  private final AtomicReference<DogLogOptions> options;

  public TunableManager(DogLogOptions initialOptions) {
    options = new AtomicReference<>(initialOptions);
  }

  public TunableBoolean create(
      String key, boolean defaultValue, @Nullable BooleanConsumer onChange) {
    var state = guarded(defaultValue, UnaryOperator.identity());
    var config = config(null, state, onChange == null ? null : onChange::accept);
    var tunable = TunableBoolean.createConfig(state::get, state::set, config);
    Tunables.publish(key, tunable);
    return tunable;
  }

  public TunableDouble create(
      String key, double defaultValue, @Nullable String unit, @Nullable DoubleConsumer onChange) {
    var state = guarded(defaultValue, UnaryOperator.identity());
    var config = config(unit, state, onChange == null ? null : onChange::accept);
    var tunable = TunableDouble.createConfig(state::get, state::set, config);
    Tunables.publish(key, tunable);
    return tunable;
  }

  public Tunable<double[]> create(
      String key,
      double[] defaultValue,
      @Nullable String unit,
      @Nullable Consumer<double[]> onChange) {
    var state = guarded(defaultValue, double[]::clone);
    var config = config(unit, state, onChange);
    var tunable = Tunable.createConfig(state::get, state::set, double[].class, config);
    Tunables.publish(key, tunable);
    return tunable;
  }

  public TunableFloat create(
      String key, float defaultValue, @Nullable String unit, @Nullable FloatConsumer onChange) {
    var state = guarded(defaultValue, UnaryOperator.identity());
    var config = config(unit, state, onChange == null ? null : onChange::accept);
    var tunable = TunableFloat.createConfig(state::get, state::set, config);
    Tunables.publish(key, tunable);
    return tunable;
  }

  public TunableLong create(
      String key, long defaultValue, @Nullable String unit, @Nullable LongConsumer onChange) {
    var state = guarded(defaultValue, UnaryOperator.identity());
    var config = config(unit, state, onChange == null ? null : onChange::accept);
    var tunable = TunableLong.createConfig(state::get, state::set, config);
    Tunables.publish(key, tunable);
    return tunable;
  }

  public <M extends Measure<?>> Tunable<M> create(
      String key, M defaultValue, @Nullable Consumer<M> onChange) {
    GuardedValue<M> state = guarded(defaultValue, UnaryOperator.identity());
    // WPILib Measure is immutable, but its interface is not annotated @ThreadSafe.
    // @infer-ignore INTERFACE_NOT_THREAD_SAFE
    var baseUnit = defaultValue.unit().getBaseUnit();
    var config = config(baseUnit.symbol(), state, onChange);
    var tunable = new GuardedMeasureTunable<>(state, config);
    Tunables.publish(key, tunable);
    return tunable;
  }

  public Tunable<String> create(
      String key, String defaultValue, @Nullable Consumer<String> onChange) {
    var state = guarded(defaultValue, UnaryOperator.identity());
    var config = config(null, state, onChange);
    var tunable = Tunable.createConfig(state::get, state::set, String.class, config);
    Tunables.publish(key, tunable);
    return tunable;
  }

  public void setOptions(DogLogOptions newOptions) {
    options.set(newOptions);
  }

  private <T> TunableConfig config(
      @Nullable String unit, GuardedValue<T> state, @Nullable Consumer<T> onChange) {
    var config = new TunableConfig();
    if (unit != null) {
      config = config.withProperty("unit", UnitTelemetry.getUnitMetadata(unit));
    }
    if (onChange != null) {
      config =
          config.withOnTune(
              () -> {
                if (isEnabled()) {
                  onChange.accept(state.get());
                }
              });
    }
    return config;
  }

  private <T> GuardedValue<T> guarded(T defaultValue, UnaryOperator<T> copy) {
    return new GuardedValue<>(defaultValue, copy, this::isEnabled);
  }

  @SuppressWarnings("NullAway")
  private boolean isEnabled() {
    return options.get().ntTunables().getAsBoolean();
  }
}
