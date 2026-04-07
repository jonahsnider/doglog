package dev.doglog.internal.writers;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;
import org.jspecify.annotations.NullMarked;
import org.wpilib.networktables.BooleanArrayPublisher;
import org.wpilib.networktables.BooleanPublisher;
import org.wpilib.networktables.DoubleArrayPublisher;
import org.wpilib.networktables.DoublePublisher;
import org.wpilib.networktables.FloatArrayPublisher;
import org.wpilib.networktables.FloatPublisher;
import org.wpilib.networktables.GenericPublisher;
import org.wpilib.networktables.IntegerArrayPublisher;
import org.wpilib.networktables.IntegerPublisher;
import org.wpilib.networktables.NetworkTable;
import org.wpilib.networktables.NetworkTableInstance;
import org.wpilib.networktables.ProtobufPublisher;
import org.wpilib.networktables.PubSub;
import org.wpilib.networktables.PubSubOption;
import org.wpilib.networktables.RawPublisher;
import org.wpilib.networktables.StringArrayPublisher;
import org.wpilib.networktables.StringPublisher;
import org.wpilib.networktables.StructArrayPublisher;
import org.wpilib.networktables.StructPublisher;
import org.wpilib.networktables.Topic;
import org.wpilib.util.protobuf.Protobuf;
import org.wpilib.util.struct.Struct;

/** Logs to NetworkTables. */
@NullMarked
public class NetworkTablesWriter implements AutoCloseable {
  private static final String PROPERTY_SOURCE_NAME = "source";
  private static final String PROPERTY_SOURCE_VALUE = "\"DogLog\"";

  private static final PubSubOption PUB_SUB_OPTIONS = PubSubOption.SEND_ALL;

  /** Updates the unit property of a numeric topic. */
  private static void updateUnitForTopic(
      Map<String, String> unitCache, String key, String unit, Topic topic) {
    var currentUnit = unitCache.get(key);
    if (unit.equals(currentUnit)) {
      return;
    }

    topic.setProperty("unit", "\"" + unit + "\"");
    unitCache.put(key, unit);
  }

  private final NetworkTable logTable;

  private final Map<String, BooleanArrayPublisher> booleanArrayPublishers =
      new ConcurrentHashMap<>();
  private final Map<String, BooleanPublisher> booleanPublishers = new ConcurrentHashMap<>();
  private final Map<String, DoubleArrayPublisher> doubleArrayPublishers = new ConcurrentHashMap<>();
  private final Map<String, DoublePublisher> doublePublishers = new ConcurrentHashMap<>();
  private final Map<String, FloatArrayPublisher> floatArrayPublishers = new ConcurrentHashMap<>();
  private final Map<String, FloatPublisher> floatPublishers = new ConcurrentHashMap<>();
  private final Map<String, IntegerArrayPublisher> integerArrayPublishers =
      new ConcurrentHashMap<>();
  private final Map<String, IntegerPublisher> integerPublishers = new ConcurrentHashMap<>();
  private final Map<String, RawPublisher> rawPublishers = new ConcurrentHashMap<>();
  private final Map<String, StringArrayPublisher> stringArrayPublishers = new ConcurrentHashMap<>();
  private final Map<String, StringPublisher> stringPublishers = new ConcurrentHashMap<>();
  private final Map<String, GenericPublisher> customStringPublishers = new ConcurrentHashMap<>();
  private final Map<String, StructArrayPublisher<?>> structArrayPublishers =
      new ConcurrentHashMap<>();
  private final Map<String, StructPublisher<?>> structPublishers = new ConcurrentHashMap<>();
  private final Map<String, ProtobufPublisher<?>> protobufPublishers = new ConcurrentHashMap<>();

  private final Map<String, String> doubleUnits = new ConcurrentHashMap<>();
  private final Map<String, String> doubleArrayUnits = new ConcurrentHashMap<>();
  private final Map<String, String> floatUnits = new ConcurrentHashMap<>();
  private final Map<String, String> floatArrayUnits = new ConcurrentHashMap<>();
  private final Map<String, String> integerUnits = new ConcurrentHashMap<>();
  private final Map<String, String> integerArrayUnits = new ConcurrentHashMap<>();

  public NetworkTablesWriter(String logTable) {
    this.logTable = NetworkTableInstance.getDefault().getTable(logTable);
  }

  @Override
  public void close() {
    Stream.of(
            booleanArrayPublishers,
            booleanPublishers,
            customStringPublishers,
            doubleArrayPublishers,
            doublePublishers,
            floatArrayPublishers,
            floatPublishers,
            integerArrayPublishers,
            integerPublishers,
            protobufPublishers,
            rawPublishers,
            stringArrayPublishers,
            stringPublishers,
            structArrayPublishers,
            structPublishers)
        .flatMap(map -> map.values().stream())
        .forEach(PubSub::close);
  }

  public void log(long timestamp, String key, boolean value) {
    var publisher = booleanPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getBooleanTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      booleanPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  public void log(long timestamp, String key, boolean[] value) {
    var publisher = booleanArrayPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getBooleanArrayTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      booleanArrayPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  public void log(long timestamp, String key, double value) {
    var publisher = doublePublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getDoubleTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      doublePublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  @SuppressWarnings("NullAway")
  public void log(long timestamp, String key, double value, String unit) {
    log(timestamp, key, value);
    updateUnitForTopic(doubleUnits, key, unit, doublePublishers.get(key).getTopic());
  }

  public void log(long timestamp, String key, double[] value) {
    var publisher = doubleArrayPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getDoubleArrayTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      doubleArrayPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  public void log(long timestamp, String key, double[] value, String unit) {
    log(timestamp, key, value);
    updateUnitForTopic(doubleArrayUnits, key, unit, logTable.getDoubleArrayTopic(key));
  }

  public void log(long timestamp, String key, float value) {
    var publisher = floatPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getFloatTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      floatPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  @SuppressWarnings("NullAway")
  public void log(long timestamp, String key, float value, String unit) {
    log(timestamp, key, value);
    updateUnitForTopic(floatUnits, key, unit, floatPublishers.get(key).getTopic());
  }

  public void log(long timestamp, String key, float[] value) {
    var publisher = floatArrayPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getFloatArrayTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      floatArrayPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  @SuppressWarnings("NullAway")
  public void log(long timestamp, String key, float[] value, String unit) {
    log(timestamp, key, value);
    updateUnitForTopic(floatArrayUnits, key, unit, floatArrayPublishers.get(key).getTopic());
  }

  public void log(long timestamp, String key, long value) {
    var publisher = integerPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getIntegerTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      integerPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  @SuppressWarnings("NullAway")
  public void log(long timestamp, String key, long value, String unit) {
    log(timestamp, key, value);
    updateUnitForTopic(integerUnits, key, unit, integerPublishers.get(key).getTopic());
  }

  public void log(long timestamp, String key, long[] value) {
    var publisher = integerArrayPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getIntegerArrayTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      integerArrayPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  @SuppressWarnings("NullAway")
  public void log(long timestamp, String key, long[] value, String unit) {
    log(timestamp, key, value);
    updateUnitForTopic(integerArrayUnits, key, unit, integerArrayPublishers.get(key).getTopic());
  }

  public <T> void log(long timestamp, String key, Protobuf<T, ?> proto, T value) {
    @SuppressWarnings("unchecked")
    var publisher = (ProtobufPublisher<T>) protobufPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getProtobufTopic(key, proto);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      protobufPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  public void log(long timestamp, String key, String value) {
    var publisher = stringPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getStringTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      stringPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  public void log(long timestamp, String key, String value, String customTypeString) {
    var publisher = customStringPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getTopic(key);
      var newPublisher = topic.genericPublish(customTypeString, PUB_SUB_OPTIONS);
      newPublisher.setString(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      customStringPublishers.put(key, newPublisher);
    } else {
      publisher.setString(value, timestamp);
    }
  }

  public void log(long timestamp, String key, String[] value) {
    var publisher = stringArrayPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getStringArrayTopic(key);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      stringArrayPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  public <T> void log(long timestamp, String key, Struct<T> struct, T value) {
    @SuppressWarnings("unchecked")
    var publisher = (StructPublisher<T>) structPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getStructTopic(key, struct);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      structPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }

  public <T> void log(long timestamp, String key, Struct<T> struct, T[] value) {
    @SuppressWarnings("unchecked")
    var publisher = (StructArrayPublisher<T>) structArrayPublishers.get(key);

    if (publisher == null) {
      var topic = logTable.getStructArrayTopic(key, struct);
      var newPublisher = topic.publish(PUB_SUB_OPTIONS);
      newPublisher.set(value, timestamp);
      topic.setProperty(PROPERTY_SOURCE_NAME, PROPERTY_SOURCE_VALUE);
      structArrayPublishers.put(key, newPublisher);
    } else {
      publisher.set(value, timestamp);
    }
  }
}
