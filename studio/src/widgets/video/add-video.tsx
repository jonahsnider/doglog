import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Layout';
import { TextInput } from '@astryxdesign/core/TextInput';
import ClapperboardIcon from 'lucide-react/icons/clapperboard';
import FileVideoIcon from 'lucide-react/icons/file-video';
import { useState } from 'react';
import { isEnterKey } from '@/lib/keyboard';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';
import { isYouTubeLink, parseVideo } from '@/widgets/video/source';
import { OrDivider } from '@/widgets/video/options';
import { startSyncing } from '@/widgets/video/state';

export function AddVideo({
	paneId,
	setOption,
	choose,
}: Pick<WidgetProps, 'paneId' | 'setOption'> & { choose: () => void }) {
	const [text, setText] = useState('');
	const [invalid, setInvalid] = useState(false);
	const addLink = (link: string) => {
		const video = parseVideo(link);
		if (video?.kind !== 'youtube') {
			setInvalid(true);
			return;
		}
		setOption('video', link.trim());
		startSyncing(paneId, video.start ?? 0);
	};

	return (
		<WidgetEmpty
			icon={<ClapperboardIcon />}
			title="Add a video"
			description="Paste a YouTube link, or choose or drop a video file, ex. the broadcast or a recording from the stands."
		>
			<VStack gap={2} width="100%">
				<TextInput
					label="YouTube link"
					isLabelHidden
					size="sm"
					width="100%"
					placeholder="YouTube link"
					inputMode="url"
					hasSpellCheck={false}
					value={text}
					status={invalid ? { type: 'error', message: 'That isn’t a YouTube video’s link.' } : undefined}
					onChange={(next) => {
						setText(next);
						setInvalid(false);
					}}
					onPaste={(event) => {
						const pasted = event.clipboardData.getData('text');
						if (isYouTubeLink(pasted)) {
							event.preventDefault();
							addLink(pasted);
						}
					}}
					onKeyDown={(event) => {
						if (isEnterKey(event)) {
							addLink(text);
						}
					}}
				/>
				<OrDivider />
				<Button label="Choose file…" icon={<FileVideoIcon />} onClick={choose} />
			</VStack>
		</WidgetEmpty>
	);
}
