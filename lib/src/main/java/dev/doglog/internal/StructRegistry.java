package dev.doglog.internal;

import edu.wpi.first.util.struct.Struct;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Used internally for working with WPILib {@link Struct}s. */
public class StructRegistry {
  private static final String STRUCT_FIELD_NAME = "struct";

  private static final Map<Class<?>, Optional<Struct<?>>> resolvedStructs = new HashMap<>();

  public static Optional<Struct<?>> getStruct(Class<?> entryClass) {
    return resolvedStructs.computeIfAbsent(entryClass, key -> getStructRaw(entryClass));
  }

  private static Optional<Struct<?>> getStructRaw(Class<?> classObj) {
    try {
      var field = classObj.getDeclaredField(STRUCT_FIELD_NAME);
      var resolvedStruct = (Struct<?>) field.get(null);

      return Optional.of(resolvedStruct);
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  private StructRegistry() {}
}
