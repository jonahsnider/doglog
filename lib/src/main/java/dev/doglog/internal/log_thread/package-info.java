/**
 * Code owned by the log thread. Nothing in here should be called by the main thread, or you risk
 * blocking user code with logging operations.
 */
package dev.doglog.internal.log_thread;
