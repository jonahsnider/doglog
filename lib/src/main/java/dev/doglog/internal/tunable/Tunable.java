// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.tunable;

import dev.doglog.DogLogOptions;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableEvent.Kind;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.NetworkTableListenerPoller;
import edu.wpi.first.util.function.BooleanConsumer;
import edu.wpi.first.util.function.FloatConsumer;
import edu.wpi.first.util.function.FloatSupplier;
import edu.wpi.first.wpilibj.Notifier;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.DoubleSupplier;
import java.util.function.LongConsumer;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

public class Tunable implements AutoCloseable {
  private static final NetworkTable TUNABLE_TABLE =
      NetworkTableInstance.getDefault().getTable("/Tunable");
  private static final EnumSet<Kind> LISTENER_EVENT_KINDS = EnumSet.of(Kind.kValueAll);

  /** Maps NT listener handles to onChange callbacks for double fields. */
  private final Map<Integer, DoubleOnChange> doubleChangeCallbacks = new HashMap<>();

  /** Maps NT listener handles to onChange callbacks for float fields. */
  private final Map<Integer, FloatOnChange> floatChangeCallbacks = new HashMap<>();

  /** Maps NT listener handles to onChange callbacks for boolean fields. */
  private final Map<Integer, BooleanOnChange> booleanChangeCallbacks = new HashMap<>();

  /** Maps NT listener handles to onChange callbacks for string fields. */
  private final Map<Integer, OnChange<String>> stringChangeCallbacks = new HashMap<>();

  /** Maps NT listener handles to onChange callbacks for long/integer fields. */
  private final Map<Integer, LongOnChange> longChangeCallbacks = new HashMap<>();

  private final NetworkTableListenerPoller poller =
      new NetworkTableListenerPoller(NetworkTableInstance.getDefault());

  private final Notifier notifier = new Notifier(this::poll);
  private boolean lastNtTunables;
  private boolean notifierStarted = false;
  private DogLogOptions options;

  public Tunable(DogLogOptions initialOptions) {
    notifier.setName("DogLog tunable poller");
    lastNtTunables = initialOptions.ntTunables().getAsBoolean();
  }

  public void setOptions(DogLogOptions newOptions) {
    options = newOptions;
  }

  public DoubleSupplier create(String key, double defaultValue, DoubleConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getDoubleTopic(key).getEntry(defaultValue);

    entry.set(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      doubleChangeCallbacks.put(listenerHandle, new DoubleOnChange(onChange, defaultValue));
    }

    return wrapDoubleSuppler(entry, defaultValue);
  }

  public FloatSupplier create(String key, float defaultValue, FloatConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getFloatTopic(key).getEntry(defaultValue);

    entry.set(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      floatChangeCallbacks.put(listenerHandle, new FloatOnChange(onChange, defaultValue));
    }

    return wrapFloatSupplier(entry, defaultValue);
  }

  public BooleanSupplier create(String key, boolean defaultValue, BooleanConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getBooleanTopic(key).getEntry(defaultValue);

    entry.set(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      booleanChangeCallbacks.put(listenerHandle, new BooleanOnChange(onChange, defaultValue));
    }

    return wrapBooleanSupplier(entry, defaultValue);
  }

  public Supplier<String> create(String key, String defaultValue, Consumer<String> onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getStringTopic(key).getEntry(defaultValue);

    entry.set(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      stringChangeCallbacks.put(listenerHandle, new OnChange<>(onChange, defaultValue));
    }

    return wrapSupplier(entry, defaultValue);
  }

  public LongSupplier create(String key, long defaultValue, LongConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getIntegerTopic(key).getEntry(defaultValue);

    entry.set(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      longChangeCallbacks.put(listenerHandle, new LongOnChange(onChange, defaultValue));
    }

    return wrapLongSupplier(entry, defaultValue);
  }

  @Override
  public void close() {
    poller.close();
    notifier.close();
  }

  private void poll() {
    var changes = poller.readQueue();

    var currentNtTunables = options.ntTunables().getAsBoolean();
    if (!currentNtTunables) {
      // NT tunables are disabled

      if (lastNtTunables) {
        // This is the first time we have disabled NT tunables, emit a change event with the default
        // values

        doubleChangeCallbacks.values().forEach(DoubleOnChange::acceptDefault);
        floatChangeCallbacks.values().forEach(FloatOnChange::acceptDefault);
        booleanChangeCallbacks.values().forEach(BooleanOnChange::acceptDefault);
        stringChangeCallbacks.values().forEach(OnChange::acceptDefault);
        longChangeCallbacks.values().forEach(LongOnChange::acceptDefault);
      }

      lastNtTunables = currentNtTunables;

      return;
    }

    for (var change : changes) {
      switch (change.valueData.value.getType()) {
        case kDouble ->
            doubleChangeCallbacks
                .get(change.listener)
                .onChange()
                .accept(change.valueData.value.getDouble());
        case kFloat ->
            floatChangeCallbacks
                .get(change.listener)
                .onChange()
                .accept(change.valueData.value.getFloat());
        case kBoolean ->
            booleanChangeCallbacks
                .get(change.listener)
                .onChange()
                .accept(change.valueData.value.getBoolean());
        case kString ->
            stringChangeCallbacks
                .get(change.listener)
                .onChange()
                .accept(change.valueData.value.getString());
        case kInteger ->
            longChangeCallbacks
                .get(change.listener)
                .onChange()
                .accept(change.valueData.value.getInteger());
        default -> {}
      }
    }
  }

  private void startNotifier() {
    if (notifierStarted) {
      return;
    }

    notifierStarted = true;
    notifier.startPeriodic(DogLogOptions.LOOP_PERIOD_SECONDS);
  }

  private DoubleSupplier wrapDoubleSuppler(DoubleSupplier supplier, double defaultValue) {
    return () -> options.ntTunables().getAsBoolean() ? supplier.getAsDouble() : defaultValue;
  }

  private FloatSupplier wrapFloatSupplier(FloatSupplier supplier, float defaultValue) {
    return () -> options.ntTunables().getAsBoolean() ? supplier.getAsFloat() : defaultValue;
  }

  private BooleanSupplier wrapBooleanSupplier(BooleanSupplier supplier, boolean defaultValue) {
    return () -> options.ntTunables().getAsBoolean() ? supplier.getAsBoolean() : defaultValue;
  }

  private <T> Supplier<T> wrapSupplier(Supplier<T> supplier, T defaultValue) {
    return () -> options.ntTunables().getAsBoolean() ? supplier.get() : defaultValue;
  }

  private LongSupplier wrapLongSupplier(LongSupplier supplier, long defaultValue) {
    return () -> options.ntTunables().getAsBoolean() ? supplier.getAsLong() : defaultValue;
  }
}
