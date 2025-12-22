package dev.doglog.internal.log_thread;

import dev.doglog.DogLogOptions;
import dev.doglog.internal.log_thread.entries.BaseQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.BooleanArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.BooleanQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.DoubleArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.DoubleArrayWithUnitQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.DoubleQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.DoubleWithUnitQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.FloatArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.FloatArrayWithUnitQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.FloatQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.FloatWithUnitQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.IntegerArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.IntegerArrayWithUnitQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.IntegerQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.IntegerWithUnitQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StringArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StringCustomTypeQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StringQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StructArrayQueuedLogEntry;
import dev.doglog.internal.log_thread.entries.StructQueuedLogEntry;
import dev.doglog.internal.log_thread.writers.CombinedWriter;
import edu.wpi.first.hal.HALUtil;
import edu.wpi.first.wpilibj.Timer;
import java.util.concurrent.BlockingQueue;

/** A thread that processes queued log entries and writes them to the log file. */
public class LogThread extends Thread {
  private final BlockingQueue<BaseQueuedLogEntry> queue;
  private final CombinedWriter logger;
  private final Timer diagnosticsTimer = new Timer();

  public LogThread(BlockingQueue<BaseQueuedLogEntry> queue, DogLogOptions initialOptions) {
    super("DogLog LogThread");
    setDaemon(true);

    this.queue = queue;

    this.logger = new CombinedWriter(initialOptions);

    diagnosticsTimer.start();
  }

  public void setOptions(DogLogOptions options) {
    logger.setOptions(options);
  }

  @Override
  public void run() {
    System.out.println("[DogLog] LogThread started");
    logger.afterLogThreadStart();

    try {
      while (true) {
        var entry = queue.take();

        // TODO: Once the minimum Java version is 21, use pattern matching for switch expressions
        // https://docs.oracle.com/en/java/javase/17/language/pattern-matching-switch-expressions-and-statements.html
        switch (entry.type) {
          case BOOLEAN -> ((BooleanQueuedLogEntry) entry).log(logger);
          case BOOLEAN_ARRAY -> ((BooleanArrayQueuedLogEntry) entry).log(logger);
          case DOUBLE -> ((DoubleQueuedLogEntry) entry).log(logger);
          case DOUBLE_ARRAY -> ((DoubleArrayQueuedLogEntry) entry).log(logger);
          case DOUBLE_WITH_UNIT -> ((DoubleWithUnitQueuedLogEntry) entry).log(logger);
          case DOUBLE_ARRAY_WITH_UNIT -> ((DoubleArrayWithUnitQueuedLogEntry) entry).log(logger);
          case FLOAT -> ((FloatQueuedLogEntry) entry).log(logger);
          case FLOAT_ARRAY -> ((FloatArrayQueuedLogEntry) entry).log(logger);
          case FLOAT_WITH_UNIT -> ((FloatWithUnitQueuedLogEntry) entry).log(logger);
          case FLOAT_ARRAY_WITH_UNIT -> ((FloatArrayWithUnitQueuedLogEntry) entry).log(logger);
          case INTEGER -> ((IntegerQueuedLogEntry) entry).log(logger);
          case INTEGER_ARRAY -> ((IntegerArrayQueuedLogEntry) entry).log(logger);
          case INTEGER_WITH_UNIT -> ((IntegerWithUnitQueuedLogEntry) entry).log(logger);
          case INTEGER_ARRAY_WITH_UNIT -> ((IntegerArrayWithUnitQueuedLogEntry) entry).log(logger);
          case STRING -> ((StringQueuedLogEntry) entry).log(logger);
          case STRING_ARRAY -> ((StringArrayQueuedLogEntry) entry).log(logger);
          case STRING_CUSTOM_TYPE -> ((StringCustomTypeQueuedLogEntry) entry).log(logger);
          case STRUCT -> ((StructQueuedLogEntry<?>) entry).log(logger);
          case STRUCT_ARRAY -> ((StructArrayQueuedLogEntry<?>) entry).log(logger);
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
