// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread;

import com.lmax.disruptor.EventHandler;
import com.lmax.disruptor.RingBuffer;
import dev.doglog.DogLogOptions;
import dev.doglog.internal.log_thread.events.LogEvent;
import dev.doglog.internal.log_thread.reporters.CombinedReporter;
import edu.wpi.first.hal.HALUtil;

public class LogThread {
  public static Thread logThreadFactory(Runnable runnable) {
    var thread = new Thread(runnable);
    thread.setName("DogLog LogThread");
    thread.setDaemon(true);

    return thread;
  }

  public static EventHandler<LogEvent> eventHandler(
      RingBuffer<LogEvent> ringBuffer, CombinedReporter logger, DogLogOptions options) {
    return (event, sequence, endOfBatch) -> {
      // TODO: Once the minimum Java version is 21, use pattern matching for switch expressions
      // https://docs.oracle.com/en/java/javase/17/language/pattern-matching-switch-expressions-and-statements.html
      switch (event.type) {
        case BOOLEAN_ARRAY -> logger.log(event.timestamp, event.key, event.getBooleanArray());
        case BOOLEAN -> logger.log(event.timestamp, event.key, event.getBoolean());
        case DOUBLE_ARRAY -> logger.log(event.timestamp, event.key, event.getDoubleArray());
        case DOUBLE -> logger.log(event.timestamp, event.key, event.getDouble());
        case FLOAT_ARRAY -> logger.log(event.timestamp, event.key, event.getFloatArray());
        case FLOAT -> logger.log(event.timestamp, event.key, event.getFloat());
        case INTEGER_ARRAY -> logger.log(event.timestamp, event.key, event.getIntegerArray());
        case INTEGER -> logger.log(event.timestamp, event.key, event.getInteger());
        case STRING_ARRAY -> logger.log(event.timestamp, event.key, event.getStringArray());
        case STRING -> logger.log(event.timestamp, event.key, event.getString());
        case STRING_CUSTOM_TYPE -> {
          var value = event.getCustomTypeString();
          logger.log(event.timestamp, event.key, value.value(), value.customTypeString());
        }
        case STRUCT_ARRAY -> logger.log(event.timestamp, event.key, event.getStructArray());
        case STRUCT -> logger.log(event.timestamp, event.key, event.getStruct());
      }

      if (endOfBatch) {
        var now = HALUtil.getFPGATime();
        var remainingCapacity = ringBuffer.remainingCapacity();
        logger.log(now, "DogLog/QueuedLogs", options.logEntryQueueCapacity() - remainingCapacity);
        logger.log(now, "DogLog/QueueRemainingCapacity", remainingCapacity);
      }
    };
  }

  private LogThread() {}
}
