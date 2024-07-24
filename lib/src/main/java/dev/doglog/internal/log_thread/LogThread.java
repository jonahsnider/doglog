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
import dev.doglog.internal.log_thread.loggers.CombinedLogger;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.wpilibj.DataLogManager;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.Timer;
import java.util.concurrent.BlockingQueue;

/** A thread that processes queued log entries and writes them to the log file. */
public class LogThread extends Thread {
  private final BlockingQueue<BaseQueuedLogEntry> queue;
  private final CombinedLogger logger;
  private final Timer diagnosticsTimer = new Timer();

  public LogThread(BlockingQueue<BaseQueuedLogEntry> queue, DogLogOptions initialOptions) {
    super("DogLog LogThread");
    setDaemon(true);

    this.queue = queue;

    // Apply NT publish setting immediately, setOptions() will enable it if needed. If capturing NT
    // is disabled, doing this prevents a single log entry of all the NT keys from being logged one
    // tick before setOptions() disables NT capture.
    DataLogManager.logNetworkTables(initialOptions.captureNt());

    this.logger = new CombinedLogger(initialOptions);

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

        if (entry instanceof BooleanArrayQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((BooleanArrayQueuedLogEntry) entry).value);
        } else if (entry instanceof BooleanQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((BooleanQueuedLogEntry) entry).value);
        } else if (entry instanceof DoubleArrayQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((DoubleArrayQueuedLogEntry) entry).value);
        } else if (entry instanceof DoubleQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((DoubleQueuedLogEntry) entry).value);
        } else if (entry instanceof FloatArrayQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((FloatArrayQueuedLogEntry) entry).value);
        } else if (entry instanceof FloatQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((FloatQueuedLogEntry) entry).value);
        } else if (entry instanceof IntegerArrayQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((IntegerArrayQueuedLogEntry) entry).value);
        } else if (entry instanceof IntegerQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((IntegerQueuedLogEntry) entry).value);
        } else if (entry instanceof StringArrayQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((StringArrayQueuedLogEntry) entry).value);
        } else if (entry instanceof StringQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((StringQueuedLogEntry) entry).value);
        } else if (entry instanceof StructArrayQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((StructArrayQueuedLogEntry<?>) entry).value);
        } else if (entry instanceof StructQueuedLogEntry) {
          logger.log(entry.timestamp, entry.key, ((StructQueuedLogEntry<?>) entry).value);
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
