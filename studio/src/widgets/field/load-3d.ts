import { preload } from 'react-dom';
import fieldModel from '@/widgets/field/2026-rebuilt.glb?url';

export const loadField3d = async () => ({ default: (await import('@/widgets/field/field-3d')).Field3d });

/** Start downloading the field model without waiting for its renderer to load. */
export function preloadField3d(): void {
	preload(fieldModel, { as: 'fetch', crossOrigin: 'anonymous', fetchPriority: 'low' });
	// A failed preload shouldn't fail navigation; the mounted widget handles its own load errors.
	void loadField3d().catch(() => undefined);
}
