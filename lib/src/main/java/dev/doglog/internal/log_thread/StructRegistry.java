package dev.doglog.internal.log_thread;

import edu.wpi.first.util.struct.Struct;
import edu.wpi.first.util.struct.StructGenerator;
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

  @SuppressWarnings("unchecked")
  private static <E extends Enum<E>> Struct<?> getEnumStructRaw(Class<?> enumClass) {
    return (Struct<?>) StructGenerator.genEnum((Class<E>) enumClass);
  }

  @SuppressWarnings("unchecked")
  private static <R extends Record> Struct<?> getRecordStructRaw(Class<?> recordClass) {
    return (Struct<?>) StructGenerator.genRecord((Class<R>) recordClass);
  }

  private final Map<Class<? extends StructSerializable>, Optional<Struct<?>>> resolvedStructs =
      new HashMap<>();
  private final Map<Class<? extends Enum<?>>, Struct<?>> resolvedEnums = new HashMap<>();
  private final Map<Class<? extends Record>, Struct<?>> resolvedRecords = new HashMap<>();

  public Optional<Struct<?>> getStruct(Class<? extends StructSerializable> entryClass) {
    return resolvedStructs.computeIfAbsent(entryClass, key -> getStructRaw(entryClass));
  }

  public Struct<?> getEnumStruct(Class<? extends Enum<?>> enumClass) {
    return resolvedEnums.computeIfAbsent(enumClass, key -> getEnumStructRaw(enumClass));
  }

  public Struct<?> getRecordStruct(Class<? extends Record> recordClass) {
    return resolvedRecords.computeIfAbsent(recordClass, key -> getRecordStructRaw(recordClass));
  }
}
