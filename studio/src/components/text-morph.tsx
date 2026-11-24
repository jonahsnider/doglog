import { TextMorph as Torph, type TextMorphProps } from 'torph/react';
import { useSelector } from '@tanstack/react-store';
import { easing } from '@/lib/motion';
import { settingsStore } from '@/settings';

export function TextMorph(props: TextMorphProps) {
	const reduceMotion = useSelector(settingsStore, (settings) => settings.reduceMotion);
	return (
		<Torph
			duration={150}
			ease={`cubic-bezier(${easing.inOut.join(', ')})`}
			{...props}
			disabled={reduceMotion || props.disabled === true}
		/>
	);
}
