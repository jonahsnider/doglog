package dev.doglog.internal.tunable;

import org.jspecify.annotations.NullMarked;
import org.wpilib.tunable.Tunable;
import org.wpilib.tunable.TunableConfig;
import org.wpilib.tunable.TunableDouble;
import org.wpilib.units.Measure;
import org.wpilib.units.Unit;

/** Adapts a guarded measure to WPILib's double-backed tunable representation. */
@NullMarked
final class GuardedMeasureTunable<M extends Measure<?>> extends Tunable<M>
    implements Tunable.CustomTunable {
  private final TunableDouble magnitudeTunable;
  private final GuardedValue<M> state;
  private final Unit unit;

  GuardedMeasureTunable(GuardedValue<M> state, TunableConfig config) {
    super(config);
    this.state = state;
    unit = state.get().unit();
    magnitudeTunable = TunableDouble.createConfig(this::getMagnitude, this::setMagnitude, config);
  }

  @Override
  public M get() {
    return state.get();
  }

  @Override
  public TunableDouble getInnerTunable() {
    return magnitudeTunable;
  }

  @Override
  @SuppressWarnings("unchecked")
  public Class<M> getTypeClass() {
    return (Class<M>) (Class<?>) Measure.class;
  }

  @Override
  public boolean hasChanged() {
    return magnitudeTunable.hasChanged();
  }

  @Override
  public void resetChanged() {
    magnitudeTunable.resetChanged();
  }

  @Override
  public void set(M value) {
    if (!unit.getBaseUnit().equivalent(value.unit().getBaseUnit())) {
      throw new IllegalArgumentException(
          "Measure unit " + value.unit() + " is not compatible with " + unit);
    }
    magnitudeTunable.set(value.baseUnitMagnitude());
  }

  @Override
  public boolean supportsChangeNotification() {
    return magnitudeTunable.supportsChangeNotification();
  }

  private double getMagnitude() {
    return state.get().baseUnitMagnitude();
  }

  @SuppressWarnings("unchecked")
  private void setMagnitude(double value) {
    state.set((M) unit.ofBaseUnits(value));
  }
}
