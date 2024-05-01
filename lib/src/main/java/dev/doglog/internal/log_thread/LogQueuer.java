// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.log_thread.entries.BaseQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.BooleanArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.BooleanQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.DoubleArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.DoubleQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.FloatArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.FloatQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.IntegerArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.IntegerQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StringArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StringQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StructArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StructQueuedLogEntry;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.DriverStation;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * Provides an interface for queueing logs to be recorded by the log thread. Also responsible for
 * managing the log thread.
 */
public class LogQueuer {
  private static final int MAX_QUEUE_FULL_MESSAGES = 50;
  private static final int DEFAULT_MAX_QUEUE_SIZE = new DogLogOptions().logEntryQueueCapacity();
  private int queueFullMessageCount = 0;

  void printQueueFullMessage(String key) {
    queueFullMessageCount++;

    if (queueFullMessageCount == MAX_QUEUE_FULL_MESSAGES) {
      DriverStation.reportError(
          "[DogLog] DOG001: Log queue is full, dropping log entry for "
              + key
              + " (additional messages will not be printed)",
          true);
    } else if (queueFullMessageCount < MAX_QUEUE_FULL_MESSAGES) {
      DriverStation.reportError(
          "[DogLog] DOG001: Log queue is full, dropping log entry for " + key, false);
    }
  }

  private BlockingQueue<BaseQueuedLogEntry> queue;
  private LogThread logThread;

  public LogQueuer(DogLogOptions initialOptions) {
    queue = new LinkedBlockingQueue<>(DEFAULT_MAX_QUEUE_SIZE);

    logThread = new LogThread(queue, initialOptions);

    logThread.start();
  }

  public void queueLog(String key, boolean[] value) {
    if (!queue.offer(new BooleanArrayQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, boolean value) {
    if (!queue.offer(new BooleanQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, double[] value) {
    if (!queue.offer(new DoubleArrayQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, double value) {
    if (!queue.offer(new DoubleQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, float[] value) {
    if (!queue.offer(new FloatArrayQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, float value) {
    if (!queue.offer(new FloatQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, int[] value) {
    queueLog(key, value);
  }

  public void queueLog(String key, long[] value) {
    if (!queue.offer(new IntegerArrayQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, int value) {
    if (!queue.offer(new IntegerQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  // TODO: Protobuf logs

  // TODO: Raw logs

  public void queueLog(String key, String[] value) {
    if (!queue.offer(new StringArrayQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, Enum<?>[] value) {
    if (value == null) {
      return;
    }
    // Convert enum array to string array
    var stringArray = new String[value.length];

    for (int i = 0; i < value.length; i++) {
      stringArray[i] = value[i].name();
    }

    queueLog(key, stringArray);
  }

  public void queueLog(String key, String value) {
    if (!queue.offer(new StringQueuedLogEntry(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(String key, Enum<?> value) {
    if (value == null) {
      return;
    }
    queueLog(key, value.name());
  }

  public <T extends StructSerializable> void queueLog(String key, T[] value) {
    if (!queue.offer(new StructArrayQueuedLogEntry<>(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public <T extends StructSerializable> void queueLog(String key, T value) {
    if (!queue.offer(new StructQueuedLogEntry<>(key, HALUtil.getFPGATime(), value))) {
      printQueueFullMessage(key);
    }
  }

  public void setOptions(DogLogOptions newOptions) {
    logThread.setOptions(newOptions);

    if (newOptions == null) {
      newOptions = new DogLogOptions();
    }

    var oldQueueMaxCapacity = queue.remainingCapacity() + queue.size();
    var newQueueMaxCapacity = newOptions.logEntryQueueCapacity();
    if (oldQueueMaxCapacity != newQueueMaxCapacity) {
      System.out.println(
          "[DogLog] Log message queue size was changed, recreating queue and starting a new log thread");
      // Queue size has changed, recreate queue & thread
      LinkedBlockingQueue<BaseQueuedLogEntry> newQueue =
          new LinkedBlockingQueue<>(newOptions.logEntryQueueCapacity());

      logThread.interrupt();

      if (oldQueueMaxCapacity > newQueueMaxCapacity) {
        DriverStation.reportWarning(
            "[DogLog] DOG002: New queue capacity is smaller than the old queue capacity, this has the potential to drop queued log entries",
            false);
      }

      queue.drainTo(newQueue, newQueue.remainingCapacity());

      var droppedLogs = queue.size();
      if (droppedLogs > 0) {
        DriverStation.reportError(
            "[DogLog] DOG003: New queue capacity is too small, dropping "
                + droppedLogs
                + " log entries",
            true);
      }

      logThread = new LogThread(newQueue, newOptions);
      logThread.start();

      queue = newQueue;
    }
  }
}
