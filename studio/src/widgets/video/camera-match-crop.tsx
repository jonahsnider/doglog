import { type PointerEvent, useCallback, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPanel,
	DialogPopup,
	DialogTitle,
} from '@/components/ui/dialog';

type Point = { x: number; y: number };
export type FrameCrop = Point & { width: number; height: number };

const minSide = 16;
const arrows: Record<string, Point | undefined> = {
	ArrowLeft: { x: -1, y: 0 },
	ArrowRight: { x: 1, y: 0 },
	ArrowUp: { x: 0, y: -1 },
	ArrowDown: { x: 0, y: 1 },
};

function bounds(a: Point, b: Point): FrameCrop {
	return {
		x: Math.min(a.x, b.x),
		y: Math.min(a.y, b.y),
		width: Math.abs(a.x - b.x),
		height: Math.abs(a.y - b.y),
	};
}

const clampPixel = (value: number, size: number) => Math.round(Math.max(0, Math.min(size, value)));

/** Selects one camera image from a frozen frame, without altering video playback or its framing. */
export function CameraMatchCrop({
	frame,
	onClose,
	onMatch,
}: {
	frame: HTMLCanvasElement;
	onClose: () => void;
	onMatch: (crop: FrameCrop) => void;
}) {
	const { width, height } = frame;
	const hint = useId();
	const preview = useRef<HTMLButtonElement>(null);
	const pointerStart = useRef<Point>(undefined);
	const [draft, setDraft] = useState<FrameCrop>();
	const [crop, setCrop] = useState<FrameCrop>();
	const [corner, setCorner] = useState<Point>();
	const [cursor, setCursor] = useState<Point>();
	const marker = cursor ?? corner;
	const drawPreview = useCallback(
		(canvas: HTMLCanvasElement | null) => {
			canvas?.getContext('2d')?.drawImage(frame, 0, 0);
		},
		[frame],
	);
	const shown = draft ?? (corner && cursor ? bounds(corner, cursor) : crop);
	const selected = crop && !draft && !corner && crop.width >= minSide && crop.height >= minSide ? crop : undefined;
	const center = { x: Math.round(width / 2), y: Math.round(height / 2) };
	const xPercent = (x: number) => `${(100 * x) / width}%`;
	const yPercent = (y: number) => `${(100 * y) / height}%`;
	const pointAt = (event: PointerEvent<HTMLButtonElement>): Point => {
		const rect = event.currentTarget.getBoundingClientRect();
		return {
			x: clampPixel(((event.clientX - rect.left) / rect.width) * width, width),
			y: clampPixel(((event.clientY - rect.top) / rect.height) * height, height),
		};
	};
	const pickCorner = (point: Point) => {
		if (corner) {
			setCrop(bounds(corner, point));
			setCorner(undefined);
		} else {
			setCorner(point);
			setCrop(undefined);
		}
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<DialogPopup className="max-w-4xl" initialFocus={preview}>
				<DialogHeader>
					<DialogTitle>Crop to one camera view</DialogTitle>
					<DialogDescription>Only tags in the cropped area are used.</DialogDescription>
				</DialogHeader>
				<DialogPanel>
					<button
						ref={preview}
						type="button"
						aria-label="Select crop on video frame"
						aria-describedby={hint}
						className="relative mx-auto block touch-none cursor-crosshair overflow-hidden rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						style={{ width: `min(100%, ${((width / height) * 58).toString()}dvh)` }}
						onPointerDown={(event) => {
							if (event.isPrimary && event.button === 0) {
								event.currentTarget.setPointerCapture(event.pointerId);
								pointerStart.current = pointAt(event);
								setCursor(undefined);
							}
						}}
						onPointerMove={(event) => {
							if (event.isPrimary && pointerStart.current) {
								setDraft(bounds(pointerStart.current, pointAt(event)));
							}
						}}
						onPointerUp={(event) => {
							if (!event.isPrimary || event.button !== 0 || !pointerStart.current) {
								return;
							}
							const end = pointAt(event);
							const box = bounds(pointerStart.current, end);
							if (box.width >= minSide && box.height >= minSide) {
								setCrop(box);
								setCorner(undefined);
							} else {
								pickCorner(end);
							}
						}}
						onLostPointerCapture={(event) => {
							if (event.isPrimary) {
								pointerStart.current = undefined;
								setDraft(undefined);
							}
						}}
						onKeyDown={(event) => {
							const step = arrows[event.key];
							if (step) {
								event.preventDefault();
								const scale = event.shiftKey ? 0.1 : 0.01;
								setCursor(({ x, y } = center) => ({
									x: clampPixel(x + step.x * Math.max(1, Math.round(width * scale)), width),
									y: clampPixel(y + step.y * Math.max(1, Math.round(height * scale)), height),
								}));
							}
						}}
						onClick={(event) => {
							if (event.detail === 0) {
								const point = cursor ?? center;
								setCursor(point);
								pickCorner(point);
							}
						}}
					>
						<canvas
							ref={drawPreview}
							width={width}
							height={height}
							className="pointer-events-none block h-auto w-full"
						/>
						{shown && (
							<span
								className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_100vmax_--theme(--color-black/55%)]"
								style={{
									left: xPercent(shown.x),
									top: yPercent(shown.y),
									width: xPercent(shown.width),
									height: yPercent(shown.height),
								}}
							/>
						)}
						{marker && (
							<span
								className="pointer-events-none absolute size-3 -translate-1/2 rounded-full border-2 border-white bg-black"
								style={{ left: xPercent(marker.x), top: yPercent(marker.y) }}
							/>
						)}
					</button>
					<span id={hint} className="sr-only">
						Use arrow keys to move and Enter to pick a corner.
					</span>
					<span className="sr-only" role="status">
						{selected ? 'Crop selected.' : corner ? 'Pick the opposite corner.' : ''}
					</span>
				</DialogPanel>
				<DialogFooter variant="bare">
					<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
					<Button
						disabled={selected === undefined}
						onClick={() => {
							if (selected) {
								onMatch(selected);
							}
						}}
					>
						Match field view
					</Button>
				</DialogFooter>
			</DialogPopup>
		</Dialog>
	);
}
