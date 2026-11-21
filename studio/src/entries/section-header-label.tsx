import EyeOffIcon from 'lucide-react/icons/eye-off';
import ListChecksIcon from 'lucide-react/icons/list-checks';
import PinIcon from 'lucide-react/icons/pin';

const sectionHeaders = {
	active: { icon: ListChecksIcon, label: 'Active' },
	pinned: { icon: PinIcon, label: 'Pinned' },
	hidden: { icon: EyeOffIcon, label: 'Hidden' },
};

export function SectionHeaderLabel({ section, count }: { section: keyof typeof sectionHeaders; count: number }) {
	const { icon: Icon, label } = sectionHeaders[section];
	return (
		<>
			<Icon className="size-3.5 shrink-0 text-muted-foreground" />
			<span className="flex-1 truncate text-start text-xs font-semibold">{label}</span>
			<span className="text-xs text-muted-foreground tabular-nums">{count}</span>
		</>
	);
}
