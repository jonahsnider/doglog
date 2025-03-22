// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.tunable;

import dev.doglog.DogLogOptions;
import edu.wpi.first.networktables.BooleanEntry;
import edu.wpi.first.networktables.DoubleEntry;
import edu.wpi.first.networktables.FloatEntry;
import edu.wpi.first.networktables.IntegerEntry;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableEvent.Kind;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.NetworkTableListenerPoller;
import edu.wpi.first.networktables.StringEntry;
import edu.wpi.first.util.function.BooleanConsumer;
import edu.wpi.first.util.function.FloatConsumer;
import edu.wpi.first.wpilibj.Notifier;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.LongConsumer;

public class Tunable implements AutoCloseable {
  private static final NetworkTable TUNABLE_TABLE =
      NetworkTableInstance.getDefault().getTable("/Tunable");
  private static final EnumSet<Kind> LISTENER_EVENT_KINDS = EnumSet.of(Kind.kValueAll);

  /** Maps NT listener handles to onChange callbacks for double fields. */
  private final HashMap<Integer, DoubleConsumer> doubleChangeCallbacks = new HashMap<>();

  /** Maps NT listener handles to onChange callbacks for float fields. */
  private final HashMap<Integer, FloatConsumer> floatChangeCallbacks = new HashMap<>();

  /** Maps NT listener handles to onChange callbacks for boolean fields. */
  private final HashMap<Integer, BooleanConsumer> booleanChangeCallbacks = new HashMap<>();

  /** Maps NT listener handles to onChange callbacks for string fields. */
  private final HashMap<Integer, Consumer<String>> stringChangeCallbacks = new HashMap<>();

  /** Maps NT listener handles to onChange callbacks for long/integer fields. */
  private final HashMap<Integer, LongConsumer> longChangeCallbacks = new HashMap<>();

  private final NetworkTableListenerPoller poller =
      new NetworkTableListenerPoller(NetworkTableInstance.getDefault());

  private final Notifier notifier = new Notifier(this::poll);
  private boolean notifierStarted = false;

  public Tunable() {
    notifier.setName("DogLog tunable poller");
  }

  public DoubleEntry create(String key, double defaultValue, DoubleConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getDoubleTopic(key).getEntry(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      doubleChangeCallbacks.put(listenerHandle, onChange);
    }

    entry.set(defaultValue);

    return entry;
  }

  public FloatEntry create(String key, float defaultValue, FloatConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getFloatTopic(key).getEntry(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      floatChangeCallbacks.put(listenerHandle, onChange);
    }

    entry.set(defaultValue);

    return entry;
  }

  public BooleanEntry create(String key, boolean defaultValue, BooleanConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getBooleanTopic(key).getEntry(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      booleanChangeCallbacks.put(listenerHandle, onChange);
    }

    entry.set(defaultValue);

    return entry;
  }

  public StringEntry create(String key, String defaultValue, Consumer<String> onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getStringTopic(key).getEntry(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      stringChangeCallbacks.put(listenerHandle, onChange);
    }

    entry.set(defaultValue);

    return entry;
  }

  public IntegerEntry create(String key, long defaultValue, LongConsumer onChange) {
    startNotifier();
    var entry = TUNABLE_TABLE.getIntegerTopic(key).getEntry(defaultValue);

    var listenerHandle = poller.addListener(entry, LISTENER_EVENT_KINDS);
    if (onChange != null) {
      longChangeCallbacks.put(listenerHandle, onChange);
    }

    entry.set(defaultValue);

    return entry;
  }

  @Override
  public void close() {
    poller.close();
    notifier.close();
  }

  private void poll() {
    var changes = poller.readQueue();

    for (var change : changes) {
      // TODO: Remove these debug logs once the type == kAssigned issue is resolved
      System.out.println("Change: " + change.valueData.getTopic().getType());
      System.out.println("Is valid: " + change.valueData.getTopic().isValid());

      switch (change.valueData.getTopic().getType()) {
        case kDouble ->
            doubleChangeCallbacks.get(change.listener).accept(change.valueData.value.getDouble());
        case kFloat ->
            floatChangeCallbacks.get(change.listener).accept(change.valueData.value.getFloat());
        case kBoolean ->
            booleanChangeCallbacks.get(change.listener).accept(change.valueData.value.getBoolean());
        case kString ->
            stringChangeCallbacks.get(change.listener).accept(change.valueData.value.getString());
        case kInteger ->
            longChangeCallbacks.get(change.listener).accept(change.valueData.value.getInteger());
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
}
