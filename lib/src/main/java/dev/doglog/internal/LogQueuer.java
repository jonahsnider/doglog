// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal;

import com.lmax.disruptor.YieldingWaitStrategy;
import com.lmax.disruptor.dsl.Disruptor;
import com.lmax.disruptor.dsl.ProducerType;
import dev.doglog.DogLogOptions;
import dev.doglog.internal.extras.ExtrasLogger;
import dev.doglog.internal.log_thread.LogThread;
import dev.doglog.internal.log_thread.events.LogEvent;
import dev.doglog.internal.log_thread.reporters.CombinedReporter;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.Alert.AlertType;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.PowerDistribution;

/**
 * Provides an interface for queueing logs to be recorded by the log thread. Also responsible for
 * managing the log thread.
 */
public class LogQueuer {
  private static final int MAX_QUEUE_FULL_MESSAGES = 50;

  private static int roundUpToPowerOf2(int value) {
    value--;
    value |= value >> 1;
    value |= value >> 2;
    value |= value >> 4;
    value |= value >> 8;
    value |= value >> 16;
    value++;

    return value;
  }

  private static Disruptor<LogEvent> createDisruptor(DogLogOptions options) {
    return new Disruptor<>(
        LogEvent::new,
        roundUpToPowerOf2(options.logEntryQueueCapacity()),
        LogThread::logThreadFactory,
        ProducerType.SINGLE,
        new YieldingWaitStrategy());
  }

  private final CombinedReporter logger;
  private final ExtrasLogger extras;
  private Disruptor<LogEvent> disruptor;
  private DogLogOptions options;

  private int queueFullMessageCount = 0;

  void printQueueFullMessage(String key) {
    if (queueFullMessageCount++ == 0) {
      // We only log a fault the first time, since adding a fault log will only cause the log queue
      // to overflow more. Without this, the robot code could crash from a call stack size exceeded
      // error, since this function is calling itself over and over.

      // We also need to increment the counter before we call logFault, since the logFault function
      // will potentially call this one

      FaultLogger.addFault(this, "[DogLog] MAX_QUEUED_LOGS", AlertType.kError);
    }

    if (queueFullMessageCount == MAX_QUEUE_FULL_MESSAGES) {
      DriverStation.reportError(
          "[DogLog] MAX_QUEUED_LOGS: Log queue is full, dropping log Event for "
              + key
              + " (additional messages will not be printed)",
          true);
    } else if (queueFullMessageCount < MAX_QUEUE_FULL_MESSAGES) {
      DriverStation.reportError(
          "[DogLog] MAX_QUEUED_LOGS: Log queue is full, dropping log Event for " + key, false);
    }
  }

  public LogQueuer(DogLogOptions initialOptions) {
    options = initialOptions;
    disruptor = createDisruptor(initialOptions);

    logger = new CombinedReporter(initialOptions);

    disruptor.handleEventsWith(
        LogThread.eventHandler(disruptor.getRingBuffer(), logger, initialOptions));

    disruptor.start();

    logger.afterLogThreadStart();

    extras = new ExtrasLogger(this, initialOptions);
  }

  public void setPdh(PowerDistribution pdh) {
    extras.setPdh(pdh);
  }

  public void queueLog(long timestamp, String key, boolean[] value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, boolean value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, double[] value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, double value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, float[] value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, float value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, int[] value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, long[] value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, long value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  // TODO: Raw logs

  public void queueLog(long timestamp, String key, String[] value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, String value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, String value, String customTypeString) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value, customTypeString))) {
      printQueueFullMessage(key);
    }
  }

  public <T extends StructSerializable> void queueLog(long timestamp, String key, T[] value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public <T extends StructSerializable> void queueLog(long timestamp, String key, T value) {
    if (!disruptor
        .getRingBuffer()
        .tryPublishEvent((event, sequence) -> event.set(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void setOptions(DogLogOptions newOptions) {
    logger.setOptions(newOptions);
    extras.setOptions(newOptions);

    var oldQueueMaxCapacity = roundUpToPowerOf2(options.logEntryQueueCapacity());
    var newQueueMaxCapacity = roundUpToPowerOf2(newOptions.logEntryQueueCapacity());

    if (oldQueueMaxCapacity != newQueueMaxCapacity) {
      System.out.println(
          "[DogLog] Log message queue size was changed, recreating queue and starting a new log thread");
      var newDisruptor = createDisruptor(newOptions);
      var oldDisruptor = disruptor;
      // Start writing events to the new queue
      disruptor = newDisruptor;
      // Finish processing events in the old queue
      oldDisruptor.shutdown();
      // Start processing events in the new queue
      disruptor.handleEventsWith(
          LogThread.eventHandler(disruptor.getRingBuffer(), logger, newOptions));
      disruptor.start();
    }

    options = newOptions;
  }
}
