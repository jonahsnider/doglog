package dev.doglog.internal.reporters;

import edu.wpi.first.networktables.BooleanArrayPublisher;
import edu.wpi.first.networktables.BooleanPublisher;
import edu.wpi.first.networktables.DoubleArrayPublisher;
import edu.wpi.first.networktables.DoublePublisher;
import edu.wpi.first.networktables.FloatArrayPublisher;
import edu.wpi.first.networktables.FloatPublisher;
import edu.wpi.first.networktables.GenericPublisher;
import edu.wpi.first.networktables.IntegerArrayPublisher;
import edu.wpi.first.networktables.IntegerPublisher;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.PubSubOption;
import edu.wpi.first.networktables.RawPublisher;
import edu.wpi.first.networktables.StringArrayPublisher;
import edu.wpi.first.networktables.StringPublisher;
import edu.wpi.first.networktables.StructArrayPublisher;
import edu.wpi.first.networktables.StructPublisher;
import edu.wpi.first.util.struct.Struct;
import java.util.HashMap;
import java.util.Map;

/** Logs to NetworkTables. */
public class NetworkTablesReporter implements AutoCloseable, Reporter {
  private static final String PROPERTY_SOURCE_NAME = "source";
  private static final String PROPERTY_SOURCE_VALUE = "\"DogLog\"";

  private static final PubSubOption PUB_SUB_OPTIONS = PubSubOption.sendAll(true);

  private final NetworkTable logTable;

  private final Map<String, BooleanArrayPublisher> booleanArrayPublishers = new HashMap<>();
  private final Map<String, BooleanPublisher> booleanPublishers = new HashMap<>();
  private final Map<String, DoubleArrayPublisher> doubleArrayPublishers = new HashMap<>();
  private final Map<String, DoublePublisher> doublePublishers = new HashMap<>();
  private final Map<String, FloatArrayPublisher> floatArrayPublishers = new HashMap<>();
  private final Map<String, FloatPublisher> floatPublishers = new HashMap<>();
  private final Map<String, IntegerArrayPublisher> integerArrayPublishers = new HashMap<>();
  private final Map<String, IntegerPublisher> integerPublishers = new HashMap<>();
  private final Map<String, RawPublisher> rawPublishers = new HashMap<>();
  private final Map<String, StringArrayPublisher> stringArrayPublishers = new HashMap<>();
  private final Map<String, StringPublisher> stringPublishers = new HashMap<>();
  private final Map<String, GenericPublisher> customStringPublishers = new HashMap<>();
  private final Map<String, StructArrayPublisher<?>> structArrayPublishers = new HashMap<>();
  private final Map<String, StructPublisher<?>> structPublishers = new HashMap<>();

  public NetworkTablesReporter(String logTable) {
    this.logTable = NetworkTableInstance.getDefault().getTable(logTable);
  }

  @Override
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

  @Override
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

  @Override
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

  @Override
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

  @Override
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

  @Override
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

  @Override
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

  @Override
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

  // TODO: Raw logs

  @Override
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

  @Override
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

  @Override
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

  @Override
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

  @Override
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

  @Override
  public void close() {
    // Close all publishers stored in the maps
    for (var publisher : booleanArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : booleanPublishers.values()) {
      publisher.close();
    }
    for (var publisher : doubleArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : doublePublishers.values()) {
      publisher.close();
    }
    for (var publisher : floatArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : floatPublishers.values()) {
      publisher.close();
    }
    for (var publisher : integerArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : integerPublishers.values()) {
      publisher.close();
    }
    for (var publisher : rawPublishers.values()) {
      publisher.close();
    }
    for (var publisher : stringArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : stringPublishers.values()) {
      publisher.close();
    }
    for (var publisher : structArrayPublishers.values()) {
      publisher.close();
    }
    for (var publisher : structPublishers.values()) {
      publisher.close();
    }
  }
}
