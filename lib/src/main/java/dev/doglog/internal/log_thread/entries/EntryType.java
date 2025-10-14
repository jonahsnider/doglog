package dev.doglog.internal.log_thread.entries;

/** The type of a queued log entry. */
public enum EntryType {
  BOOLEAN_ARRAY,
  BOOLEAN,
  DOUBLE_ARRAY,
  DOUBLE,
  DOUBLE_WITH_UNIT,
  FLOAT_ARRAY,
  FLOAT,
  INTEGER_ARRAY,
  INTEGER,
  STRING_ARRAY,
  STRING,
  STRING_CUSTOM_TYPE,
  STRUCT_ARRAY,
  STRUCT,
}
