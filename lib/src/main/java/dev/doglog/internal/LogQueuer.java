// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.extras.ExtrasLogger;
import dev.doglog.internal.log_thread.LogThread;
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
import dev.doglog.internal.log_thread.entries.StringCustomTypeQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StringQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StructArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StructQueuedLogEntry;
import edu.wpi.first.util.struct.StructSerializable;
import edu.wpi.first.wpilibj.Alert.AlertType;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.PowerDistribution;
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
          "[DogLog] MAX_QUEUED_LOGS: Log queue is full, dropping log entry for "
              + key
              + " (additional messages will not be printed)",
          true);
    } else if (queueFullMessageCount < MAX_QUEUE_FULL_MESSAGES) {
      DriverStation.reportError(
          "[DogLog] MAX_QUEUED_LOGS: Log queue is full, dropping log entry for " + key, false);
    }
  }

  private final ExtrasLogger extras;
  private BlockingQueue<BaseQueuedLogEntry> queue;
  private LogThread logThread;

  public LogQueuer(DogLogOptions initialOptions) {
    queue = new LinkedBlockingQueue<>(DEFAULT_MAX_QUEUE_SIZE);

    logThread = new LogThread(queue, initialOptions);

    logThread.start();

    extras = new ExtrasLogger(this, initialOptions);
  }

  public void setPdh(PowerDistribution pdh) {
    extras.setPdh(pdh);
  }

  public void queueLog(long timestamp, String key, boolean[] value) {
    if (!queue.offer(new BooleanArrayQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, boolean value) {
    if (!queue.offer(new BooleanQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, double[] value) {
    if (!queue.offer(new DoubleArrayQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, double value) {
    if (!queue.offer(new DoubleQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, float[] value) {
    if (!queue.offer(new FloatArrayQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, float value) {
    if (!queue.offer(new FloatQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, int[] value) {
    if (!queue.offer(new IntegerArrayQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, long[] value) {
    if (!queue.offer(new IntegerArrayQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, long value) {
    if (!queue.offer(new IntegerQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  // TODO: Raw logs

  public void queueLog(long timestamp, String key, String[] value) {
    if (!queue.offer(new StringArrayQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, String value) {
    if (!queue.offer(new StringQueuedLogEntry(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void queueLog(long timestamp, String key, String value, String customTypeString) {
    if (!queue.offer(new StringCustomTypeQueuedLogEntry(key, timestamp, value, customTypeString))) {
      printQueueFullMessage(key);
    }
  }

  public <T extends StructSerializable> void queueLog(long timestamp, String key, T[] value) {
    if (!queue.offer(new StructArrayQueuedLogEntry<>(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public <T extends StructSerializable> void queueLog(long timestamp, String key, T value) {
    if (!queue.offer(new StructQueuedLogEntry<>(key, timestamp, value))) {
      printQueueFullMessage(key);
    }
  }

  public void setOptions(DogLogOptions newOptions) {
    logThread.setOptions(newOptions);
    extras.setOptions(newOptions);

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
            "[DogLog] RISKY_QUEUE_RESIZE: New queue capacity is smaller than the old queue capacity, this has the potential to drop queued log entries",
            false);
        FaultLogger.addFault(this, "[DogLog] RISKY_QUEUE_RESIZE", AlertType.kWarning);
      }

      queue.drainTo(newQueue, newQueue.remainingCapacity());

      var droppedLogs = queue.size();
      if (droppedLogs > 0) {
        DriverStation.reportError(
            "[DogLog] QUEUE_RESIZE_DROPPED_LOGS: New queue capacity is too small, dropping "
                + droppedLogs
                + " log entries",
            true);
        FaultLogger.addFault(this, "[DogLog] QUEUE_RESIZE_DROPPED_LOGS", AlertType.kError);
      }

      logThread = new LogThread(newQueue, newOptions);
      logThread.start();

      queue = newQueue;
    }
  }
}
