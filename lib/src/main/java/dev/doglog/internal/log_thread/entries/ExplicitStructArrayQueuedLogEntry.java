package dev.doglog.internal.log_thread.entries;

import edu.wpi.first.util.struct.Struct;

public class ExplicitStructArrayQueuedLogEntry <T> extends BaseQueuedLogEntry {
	public final T[] value;
	public final Struct<T> struct;
	
	public ExplicitStructArrayQueuedLogEntry(String key, long timestamp, T[] value, Struct<T> struct) {
		super(EntryType.EXPLICIT_STRUCT_ARRAY, key, timestamp);
		this.value = value;
		this.struct = struct;
	}
}
