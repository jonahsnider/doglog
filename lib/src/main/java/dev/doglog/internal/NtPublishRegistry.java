package dev.doglog.internal;

import static java.util.Objects.requireNonNull;

import dev.doglog.DogLog.NtPublishMark;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.NullMarked;

/** Tracks which log keys are marked for NetworkTables publishing. */
@NullMarked
public final class NtPublishRegistry {
  private static final Set<String> MARKED = ConcurrentHashMap.newKeySet();

  private NtPublishRegistry() {}

  public static void mark(String key, NtPublishMark mark) {
    requireNonNull(key, "key");
    requireNonNull(mark, "mark");
    if (mark == NtPublishMark.PUBLISH) {
      MARKED.add(key);
    } else {
      MARKED.remove(key);
    }
  }

  public static boolean isMarked(String key) {
    requireNonNull(key, "key");
    return MARKED.contains(key);
  }
}
