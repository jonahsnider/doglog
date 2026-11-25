import { TextMorph as Torph, type TextMorphProps } from 'torph/react';
import { useSelector } from '@tanstack/react-store';
import { duration, easing } from '@/lib/motion';
import { settingsStore } from '@/settings';

export function TextMorph(props: TextMorphProps) {
	const reduceMotion = useSelector(settingsStore, (settings) => settings.reduceMotion);
	return (
		<Torph
			duration={duration.fast * 1000}
			ease={`cubic-bezier(${easing.standard.join(', ')})`}
			{...props}
			disabled={reduceMotion || props.disabled === true}
		/>
	);
}
