// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.internal.log_thread.entries;

/** The type of a queued log entry. */
public enum EntryType {
  BOOLEAN_ARRAY,
  BOOLEAN,
  DOUBLE_ARRAY,
  DOUBLE,
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
