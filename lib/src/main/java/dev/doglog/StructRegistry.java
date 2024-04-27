// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package dev.doglog;

import edu.wpi.first.util.datalog.DataLog;
import edu.wpi.first.util.struct.Struct;
import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Used internally for working with WPILib {@link Struct}s. */
public class StructRegistry {
  private static final Map<String, Struct<?>> structTypeCache = new HashMap<>();

  private static DataLog log;

  public static Optional<Struct<?>> findStructType(Class<?> classObj) {
    if (!structTypeCache.containsKey(classObj.getName())) {
      structTypeCache.put(classObj.getName(), null);
      Field field = null;
      try {
        field = classObj.getDeclaredField("struct");
      } catch (NoSuchFieldException | SecurityException e) {
      }
      if (field != null) {
        try {
          structTypeCache.put(classObj.getName(), (Struct<?>) field.get(null));
        } catch (IllegalArgumentException | IllegalAccessException e) {
        }
      }
    }

    Optional<Struct<?>> struct =
        Optional.ofNullable((Struct<?>) structTypeCache.get(classObj.getName()));

    if (struct.isPresent() && log != null) {
      log.addSchema(struct.get());
    }

    return struct;
  }

  public static void setLog(DataLog log) {
    StructRegistry.log = log;
  }

  private StructRegistry() {}
}
