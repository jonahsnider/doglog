import { DumbbellIcon, type LucideIcon, SwordsIcon, TrophyIcon } from 'lucide-react';
import type { MatchType } from '@/sync/log-names';

/** How each kind of match is shown */
export const matchIcons: Record<MatchType, { icon: LucideIcon; label: string }> = {
	practice: { icon: DumbbellIcon, label: 'Practice match' },
	qualification: { icon: SwordsIcon, label: 'Qualification match' },
	elimination: { icon: TrophyIcon, label: 'Elimination match' },
};
