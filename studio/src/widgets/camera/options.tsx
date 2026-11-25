import { useSelector } from '@tanstack/react-store';
import { Selector } from '@astryxdesign/core/Selector';
import { cameraNames, cameraStreams } from '@/data/camera-streams';
import { useSource } from '@/data/source-store';
import type { OptionControlProps } from '@/widgets/widget-type';

export function CameraOptionControl({ values, setOption }: OptionControlProps) {
	return <CameraPicker value={values['camera']} hasLabel onChange={(name) => setOption('camera', name)} />;
}

export function CameraPicker({
	value = '',
	hasLabel = false,
	onChange,
}: {
	value?: string | undefined;
	/** Shows the Camera label, as in the widget's options. Without it, the picker is labeled by what's around it. */
	hasLabel?: boolean;
	onChange: (name: string) => void;
}) {
	const source = useSource();
	const streams = useSelector(cameraStreams);
	const names = source?.type === 'live' && source.status === 'connected' ? cameraNames(streams) : [];
	const unavailable = value !== '' && !names.includes(value);
	return (
		<Selector
			label="Camera"
			isLabelHidden={!hasLabel}
			size="sm"
			width={hasLabel ? '100%' : undefined}
			options={[...(unavailable ? [{ value, label: `${value} (unavailable)`, disabled: true }] : []), ...names]}
			value={value === '' ? undefined : value}
			placeholder={names.length > 0 ? 'Choose camera' : 'No cameras available'}
			isDisabled={names.length === 0}
			onChange={(name) => {
				if (name !== null) {
					onChange(name);
				}
			}}
		/>
	);
}
