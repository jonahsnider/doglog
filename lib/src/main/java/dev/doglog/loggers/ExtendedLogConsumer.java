// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog.loggers;

import edu.wpi.first.util.struct.StructSerializable;

public interface ExtendedLogConsumer extends LogConsumer {
  public void log(String key, Enum<?>[] value);

  public void log(String key, Enum<?> value);

  public <T extends StructSerializable> void log(String key, T[] value);

  public <T extends StructSerializable> void log(String key, T value);
}
