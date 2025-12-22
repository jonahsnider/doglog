package dev.doglog.internal.log_thread;

import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructSerializable;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Used internally for working with WPILib {@link Struct}s. */
public class StructRegistry {
  private static final String STRUCT_FIELD_NAME = "struct";

  private static <T extends StructSerializable> Optional<Struct<?>> getStructRaw(
      Class<T> classObj) {
    try {
      var field = classObj.getDeclaredField(STRUCT_FIELD_NAME);
      @SuppressWarnings("unchecked")
      var resolvedStruct = (Struct<T>) field.get(null);

      return Optional.of(resolvedStruct);
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  private final Map<Class<?>, Optional<Struct<?>>> resolvedStructs = new HashMap<>();

  public Optional<Struct<?>> getStruct(Class<?> entryClass) {
    return resolvedStructs.computeIfAbsent(entryClass, key -> getStructRaw(entryClass));
  }
}
