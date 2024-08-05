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
import dev.doglog.internal.log_thread.reporters.CombinedReporter;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.Timer;
import java.util.concurrent.BlockingQueue;

/** A thread that processes queued log entries and writes them to the log file. */
public class LogThread extends Thread {
  private final BlockingQueue<BaseQueuedLogEntry> queue;
  private final CombinedReporter logger;
  private final Timer diagnosticsTimer = new Timer();

  public LogThread(BlockingQueue<BaseQueuedLogEntry> queue, DogLogOptions initialOptions) {
    super("DogLog LogThread");
    setDaemon(true);

    this.queue = queue;

    // Apply initial options that this class is responsible for
    DataLogManager.logNetworkTables(initialOptions.captureNt());

    var log = DataLogManager.getLog();

    if (initialOptions.captureDs()) {
      DriverStation.startDataLog(log);
    }

    this.logger = new CombinedReporter(initialOptions);

    diagnosticsTimer.start();
  }

  public void setOptions(DogLogOptions options) {
    DataLogManager.logNetworkTables(options.captureNt());

    var log = DataLogManager.getLog();

    if (options.captureDs()) {
      DriverStation.startDataLog(log);
    }

    logger.setOptions(options);
  }

  @Override
  public void run() {
    System.out.println("[DogLog] LogThread started");

    try {
      while (true) {
        var entry = queue.take();

        // TODO: Once the minimum Java version is 21, use pattern matching for switch expressions
        // https://docs.oracle.com/en/java/javase/17/language/pattern-matching-switch-expressions-and-statements.html
        switch (entry.type) {
          case BOOLEAN_ARRAY:
            logger.log(entry.timestamp, entry.key, ((BooleanArrayQueuedLogEntry) entry).value);
            break;
          case BOOLEAN:
            logger.log(entry.timestamp, entry.key, ((BooleanQueuedLogEntry) entry).value);
            break;
          case DOUBLE_ARRAY:
            logger.log(entry.timestamp, entry.key, ((DoubleArrayQueuedLogEntry) entry).value);
            break;
          case DOUBLE:
            logger.log(entry.timestamp, entry.key, ((DoubleQueuedLogEntry) entry).value);
            break;
          case FLOAT_ARRAY:
            logger.log(entry.timestamp, entry.key, ((FloatArrayQueuedLogEntry) entry).value);
            break;
          case FLOAT:
            logger.log(entry.timestamp, entry.key, ((FloatQueuedLogEntry) entry).value);
            break;
          case INTEGER_ARRAY:
            logger.log(entry.timestamp, entry.key, ((IntegerArrayQueuedLogEntry) entry).value);
            break;
          case INTEGER:
            logger.log(entry.timestamp, entry.key, ((IntegerQueuedLogEntry) entry).value);
            break;
          case STRING_ARRAY:
            logger.log(entry.timestamp, entry.key, ((StringArrayQueuedLogEntry) entry).value);
            break;
          case STRING:
            logger.log(entry.timestamp, entry.key, ((StringQueuedLogEntry) entry).value);
            break;
          case STRUCT_ARRAY:
            logger.log(entry.timestamp, entry.key, ((StructArrayQueuedLogEntry<?>) entry).value);
            break;
          case STRUCT:
            logger.log(entry.timestamp, entry.key, ((StructQueuedLogEntry<?>) entry).value);
            break;
        }

        if (diagnosticsTimer.hasElapsed(DogLogOptions.LOOP_PERIOD_SECONDS)) {
          diagnosticsTimer.reset();
          var now = HALUtil.getFPGATime();
          logger.log(now, "DogLog/QueuedLogs", queue.size());
          logger.log(now, "DogLog/QueueRemainingCapacity", queue.remainingCapacity());
        }
      }
    } catch (InterruptedException e) {
      // Restore the interrupted status
      Thread.currentThread().interrupt();
    }
  }
}
