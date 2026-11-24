import { useSelector } from '@tanstack/react-store';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cameraNames, cameraStreams } from '@/data/camera-streams';
import { useSource } from '@/data/source-store';
import type { OptionControlProps } from '@/widgets/widget-type';

export function CameraOptionControl({ values, setOption }: OptionControlProps) {
	return <CameraPicker value={values['camera']} onChange={(name) => setOption('camera', name)} />;
}

export function CameraPicker({
	value = '',
	onChange,
}: {
	value?: string | undefined;
	onChange: (name: string) => void;
}) {
	const source = useSource();
	const streams = useSelector(cameraStreams);
	const names = source?.type === 'live' && source.status === 'connected' ? cameraNames(streams) : [];
	const items = names.map((name) => ({ value: name, label: name }));
	return (
		<Select
			items={items}
			value={value === '' ? null : value}
			disabled={items.length === 0}
			onValueChange={(name) => {
				if (name !== null) {
					onChange(name);
				}
			}}
		>
			<SelectTrigger size="sm" aria-label="Camera">
				<SelectValue placeholder={items.length > 0 ? 'Choose camera' : 'No cameras available'}>
					{value !== '' && !names.includes(value) ? `${value} (unavailable)` : undefined}
				</SelectValue>
			</SelectTrigger>
			<SelectPopup alignItemWithTrigger={false}>
				{items.map(({ value: name, label }) => (
					<SelectItem key={name} value={name}>
						{label}
					</SelectItem>
				))}
			</SelectPopup>
		</Select>
	);
}
