package dev.doglog.internal;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.wpilib.util.struct.Struct;
import org.wpilib.util.struct.StructGenerator;
import org.wpilib.util.struct.StructSerializable;

/** Used internally for working with WPILib {@link Struct}s. */
public class StructRegistry {
  private static final String STRUCT_FIELD_NAME = "struct";

  @SuppressWarnings("unchecked")
  private static <E extends Enum<E>> Struct<?> getEnumStructRaw(Class<?> enumClass) {
    return (Struct<?>) StructGenerator.genEnum((Class<E>) enumClass);
  }

  @SuppressWarnings("unchecked")
  private static <R extends Record> Struct<?> getRecordStructRaw(Class<?> recordClass) {
    return (Struct<?>) StructGenerator.genRecord((Class<R>) recordClass);
  }

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

  private final Map<Class<? extends StructSerializable>, Optional<Struct<?>>> resolvedStructs =
      new HashMap<>();
  private final Map<Class<? extends Enum<?>>, Struct<?>> resolvedEnums = new HashMap<>();
  private final Map<Class<? extends Record>, Struct<?>> resolvedRecords = new HashMap<>();

  public Struct<?> getEnumStruct(Class<? extends Enum<?>> enumClass) {
    return resolvedEnums.computeIfAbsent(enumClass, key -> getEnumStructRaw(enumClass));
  }

  public Struct<?> getRecordStruct(Class<? extends Record> recordClass) {
    return resolvedRecords.computeIfAbsent(recordClass, key -> getRecordStructRaw(recordClass));
  }

  public Optional<Struct<?>> getStruct(Class<? extends StructSerializable> entryClass) {
    return resolvedStructs.computeIfAbsent(entryClass, key -> getStructRaw(entryClass));
  }
}
