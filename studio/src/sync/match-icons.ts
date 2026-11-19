import DumbbellIcon from 'lucide-react/icons/dumbbell';
import SwordsIcon from 'lucide-react/icons/swords';
import TrophyIcon from 'lucide-react/icons/trophy';
import type { LucideIcon } from 'lucide-react/types';
import type { MatchType } from '@/sync/log-names';

/** How each kind of match is shown */
export const matchIcons: Record<MatchType, { icon: LucideIcon; label: string }> = {
	practice: { icon: DumbbellIcon, label: 'Practice match' },
	qualification: { icon: SwordsIcon, label: 'Qualification match' },
	elimination: { icon: TrophyIcon, label: 'Elimination match' },
};
