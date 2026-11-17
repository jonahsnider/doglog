import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

/** Whether the sidebar only shows icons */
export const sidebarCollapsedStore = createPersistedAtom('sidebar-collapsed', z.boolean(), false, { perWindow: true });
