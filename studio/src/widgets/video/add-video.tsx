import ClapperboardIcon from 'lucide-react/icons/clapperboard';
import FileVideoIcon from 'lucide-react/icons/file-video';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isEnterKey } from '@/lib/keyboard';
import { WidgetEmpty } from '@/widgets/widget-empty';
import type { WidgetProps } from '@/widgets/widget-type';
import { isYouTubeLink, parseVideo } from '@/widgets/video/source';
import { OrDivider } from '@/widgets/video/options';
import { startSyncing } from '@/widgets/video/state';
import { useAddVideo } from '@/widgets/video/use-add-video';

type SetOption = WidgetProps['setOption'];

export function AddVideo({ paneId, setOption }: { paneId: string; setOption: SetOption }) {
	const { choose, dropProps } = useAddVideo(paneId, setOption);
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
		<div {...dropProps} className="h-full">
			<WidgetEmpty
				icon={<ClapperboardIcon />}
				title="Add a video"
				description="Paste a YouTube link, or choose or drop a video file, ex. the broadcast or a recording from the stands."
			>
				<div className="flex w-full max-w-72 flex-col gap-2">
					<Input
						size="sm"
						aria-label="YouTube link"
						placeholder="YouTube link"
						aria-invalid={invalid || undefined}
						onChange={() => setInvalid(false)}
						onPaste={(event) => {
							const text = event.clipboardData.getData('text');
							if (isYouTubeLink(text)) {
								event.preventDefault();
								addLink(text);
							}
						}}
						onKeyDown={(event) => {
							if (isEnterKey(event)) {
								addLink(event.currentTarget.value);
							}
						}}
					/>
					{invalid && <p className="text-xs text-destructive-foreground">That isn’t a YouTube video’s link.</p>}
					<OrDivider />
					<Button variant="outline" size="sm" onClick={choose}>
						<FileVideoIcon />
						Choose file…
					</Button>
				</div>
			</WidgetEmpty>
		</div>
	);
}
