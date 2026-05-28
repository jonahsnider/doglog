package dev.doglog.internal.tunable;

import com.google.errorprone.annotations.ThreadSafe;
import dev.doglog.DogLogOptions;
import dev.doglog.internal.tunable.entry.ToggleableBooleanSubscriber;
import dev.doglog.internal.tunable.entry.ToggleableDoubleArraySubscriber;
import dev.doglog.internal.tunable.entry.ToggleableDoubleSubscriber;
import dev.doglog.internal.tunable.entry.ToggleableFloatSubscriber;
import dev.doglog.internal.tunable.entry.ToggleableIntegerSubscriber;
import dev.doglog.internal.tunable.entry.ToggleableStringSubscriber;
import dev.doglog.internal.tunable.on_change.BooleanOnChange;
import dev.doglog.internal.tunable.on_change.DoubleOnChange;
import dev.doglog.internal.tunable.on_change.FloatOnChange;
import dev.doglog.internal.tunable.on_change.LongOnChange;
import dev.doglog.internal.tunable.on_change.OnChange;
import java.util.EnumSet;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.LongConsumer;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.wpilib.networktables.BooleanSubscriber;
import org.wpilib.networktables.DoubleArraySubscriber;
import org.wpilib.networktables.DoubleSubscriber;
import org.wpilib.networktables.FloatSubscriber;
import org.wpilib.networktables.IntegerSubscriber;
import org.wpilib.networktables.NetworkTable;
import org.wpilib.networktables.NetworkTableEvent.Kind;
import org.wpilib.networktables.NetworkTableInstance;
import org.wpilib.networktables.NetworkTableListenerPoller;
import org.wpilib.networktables.StringSubscriber;
import org.wpilib.system.Notifier;
import org.wpilib.util.function.BooleanConsumer;
import org.wpilib.util.function.FloatConsumer;

@NullMarked
@ThreadSafe
public class Tunable implements AutoCloseable {
  private static final NetworkTable TUNABLE_TABLE =
      NetworkTableInstance.getDefault().getTable("/Tunable");
  private static final EnumSet<Kind> LISTENER_EVENT_KINDS = EnumSet.of(Kind.VALUE_ALL);

  /** Maps NT listener handles to onChange callbacks for double fields. */
  private final Map<Integer, DoubleOnChange> doubleChangeCallbacks = new ConcurrentHashMap<>();

  /** Maps NT listener handles to onChange callbacks for double array fields. */
  private final Map<Integer, OnChange<double[]>> doubleArrayChangeCallbacks =
      new ConcurrentHashMap<>();

  /** Maps NT listener handles to onChange callbacks for float fields. */
  private final Map<Integer, FloatOnChange> floatChangeCallbacks = new ConcurrentHashMap<>();

  /** Maps NT listener handles to onChange callbacks for boolean fields. */
  private final Map<Integer, BooleanOnChange> booleanChangeCallbacks = new ConcurrentHashMap<>();

  /** Maps NT listener handles to onChange callbacks for string fields. */
  private final Map<Integer, OnChange<String>> stringChangeCallbacks = new ConcurrentHashMap<>();

  /** Maps NT listener handles to onChange callbacks for long/integer fields. */
  private final Map<Integer, LongOnChange> longChangeCallbacks = new ConcurrentHashMap<>();

  private final NetworkTableListenerPoller poller =
      new NetworkTableListenerPoller(NetworkTableInstance.getDefault());

  private final Notifier notifier = new Notifier(this::poll);
  private final AtomicBoolean lastNtTunables;
  private final AtomicBoolean notifierStarted = new AtomicBoolean(false);
  private final AtomicReference<DogLogOptions> options;

  public Tunable(DogLogOptions initialOptions) {
    notifier.setName("DogLog tunable poller");
    options = new AtomicReference<>(initialOptions);
    lastNtTunables = new AtomicBoolean(initialOptions.ntTunables().getAsBoolean());
  }

  @Override
  public void close() {
    poller.close();
    notifier.close();
  }

  @SuppressWarnings("NullAway")
  public BooleanSubscriber create(
      String key, boolean defaultValue, @Nullable BooleanConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getBooleanTopic(key).getEntry(defaultValue);

    entry.set(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      booleanChangeCallbacks.put(listenerHandle, new BooleanOnChange(onChange, defaultValue));
    }

    return new ToggleableBooleanSubscriber(
        entry, defaultValue, () -> options.get().ntTunables().getAsBoolean());
  }

  @SuppressWarnings("NullAway")
  public DoubleSubscriber create(
      String key, double defaultValue, @Nullable String unit, @Nullable DoubleConsumer onChange) {
    startNotifier();
    var topic = TUNABLE_TABLE.getDoubleTopic(key);
    var entry = topic.getEntry(defaultValue);

    entry.set(defaultValue);

    if (unit != null) {
      topic.setProperty("unit", "\"" + unit + "\"");
    }

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      doubleChangeCallbacks.put(listenerHandle, new DoubleOnChange(onChange, defaultValue));
    }

    return new ToggleableDoubleSubscriber(
        entry, defaultValue, () -> options.get().ntTunables().getAsBoolean());
  }

  @SuppressWarnings("NullAway")
  public DoubleArraySubscriber create(
      String key,
      double[] defaultValue,
      @Nullable String unit,
      @Nullable Consumer<double[]> onChange) {
    startNotifier();
    var topic = TUNABLE_TABLE.getDoubleArrayTopic(key);
    var entry = topic.getEntry(defaultValue);

    entry.set(defaultValue);

    if (unit != null) {
      topic.setProperty("unit", "\"" + unit + "\"");
    }

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      doubleArrayChangeCallbacks.put(listenerHandle, new OnChange<>(onChange, defaultValue));
    }

    return new ToggleableDoubleArraySubscriber(
        entry, defaultValue, () -> options.get().ntTunables().getAsBoolean());
  }

  @SuppressWarnings("NullAway")
  public FloatSubscriber create(
      String key, float defaultValue, @Nullable String unit, @Nullable FloatConsumer onChange) {
    startNotifier();
    var topic = TUNABLE_TABLE.getFloatTopic(key);
    var entry = topic.getEntry(defaultValue);

    entry.set(defaultValue);

    if (unit != null) {
      topic.setProperty("unit", "\"" + unit + "\"");
    }

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      floatChangeCallbacks.put(listenerHandle, new FloatOnChange(onChange, defaultValue));
    }

    return new ToggleableFloatSubscriber(
        entry, defaultValue, () -> options.get().ntTunables().getAsBoolean());
  }

  @SuppressWarnings("NullAway")
  public IntegerSubscriber create(
      String key, long defaultValue, @Nullable String unit, @Nullable LongConsumer onChange) {
    startNotifier();
    var topic = TUNABLE_TABLE.getIntegerTopic(key);
    var entry = topic.getEntry(defaultValue);

    entry.set(defaultValue);

    if (unit != null) {
      topic.setProperty("unit", "\"" + unit + "\"");
    }

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      longChangeCallbacks.put(listenerHandle, new LongOnChange(onChange, defaultValue));
    }

    return new ToggleableIntegerSubscriber(
        entry, defaultValue, () -> options.get().ntTunables().getAsBoolean());
  }

  @SuppressWarnings("NullAway")
  public StringSubscriber create(
      String key, String defaultValue, @Nullable Consumer<String> onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getStringTopic(key).getEntry(defaultValue);

    entry.set(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      stringChangeCallbacks.put(listenerHandle, new OnChange<>(onChange, defaultValue));
    }

    return new ToggleableStringSubscriber(
        entry, defaultValue, () -> options.get().ntTunables().getAsBoolean());
  }

  public void setOptions(DogLogOptions newOptions) {
    options.set(newOptions);
  }

  @SuppressWarnings("NullAway")
  private void poll() {
    var changes = poller.readQueue();

    var currentNtTunables = options.get().ntTunables().getAsBoolean();

    if (currentNtTunables) {
      // NT tunables are enabled

      for (var change : changes) {
        switch (change.valueData.value.getType()) {
          case DOUBLE -> {
            var callback = doubleChangeCallbacks.get(change.listener);
            if (callback != null) {
              callback.onChange().accept(change.valueData.value.getDouble());
            }
          }
          case DOUBLE_ARRAY -> {
            var callback = doubleArrayChangeCallbacks.get(change.listener);
            if (callback != null) {
              callback.onChange().accept(change.valueData.value.getDoubleArray());
            }
          }
          case FLOAT -> {
            var callback = floatChangeCallbacks.get(change.listener);
            if (callback != null) {
              callback.onChange().accept(change.valueData.value.getFloat());
            }
          }
          case BOOLEAN -> {
            var callback = booleanChangeCallbacks.get(change.listener);
            if (callback != null) {
              callback.onChange().accept(change.valueData.value.getBoolean());
            }
          }
          case STRING -> {
            var callback = stringChangeCallbacks.get(change.listener);
            if (callback != null) {
              callback.onChange().accept(change.valueData.value.getString());
            }
          }
          case INTEGER -> {
            var callback = longChangeCallbacks.get(change.listener);
            if (callback != null) {
              callback.onChange().accept(change.valueData.value.getInteger());
            }
          }
          default -> {}
        }
      }
    } else if (lastNtTunables.get()) {
      // This is the first time we have disabled NT tunables, emit a change event with the default
      // values

      doubleChangeCallbacks.values().forEach(DoubleOnChange::acceptDefault);
      doubleArrayChangeCallbacks.values().forEach(OnChange::acceptDefault);
      floatChangeCallbacks.values().forEach(FloatOnChange::acceptDefault);
      booleanChangeCallbacks.values().forEach(BooleanOnChange::acceptDefault);
      stringChangeCallbacks.values().forEach(OnChange::acceptDefault);
      longChangeCallbacks.values().forEach(LongOnChange::acceptDefault);
    }

    lastNtTunables.set(currentNtTunables);
  }

  private void startNotifier() {
    if (notifierStarted.compareAndSet(false, true)) {
      notifier.startPeriodic(DogLogOptions.LOOP_PERIOD_SECONDS);
    }
  }
}
