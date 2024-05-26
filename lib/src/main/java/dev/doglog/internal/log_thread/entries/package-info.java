/**
 * Log entry classes. Rather than having a single generic class with a `Object value` field, we have
 * separate classes for each type of log entry. This allows the JVM to optimize the code better,
 * since casting from `Object` makes it harder for the JIT to work.
 */
package dev.doglog.internal.log_thread.entries;
