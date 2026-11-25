import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { radiusVars } from '@astryxdesign/core/theme/tokens.stylex';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';
import * as stylex from '@stylexjs/stylex';
import { type PointerEvent, useCallback, useId, useRef, useState } from 'react';

type Point = { x: number; y: number };
export type FrameCrop = Point & { width: number; height: number };

const minSide = 16;

function bounds(a: Point, b: Point): FrameCrop {
	return {
		x: Math.min(a.x, b.x),
		y: Math.min(a.y, b.y),
		width: Math.abs(a.x - b.x),
		height: Math.abs(a.y - b.y),
	};
}

const styles = stylex.create({
	frame: {
		position: 'relative',
		marginInline: 'auto',
		overflow: 'hidden',
		borderRadius: radiusVars['--radius-inner'],
		cursor: 'crosshair',
		touchAction: 'none',
		userSelect: 'none',
	},
	hint: {
		textAlign: 'center',
	},
	canvas: {
		display: 'block',
		width: '100%',
		height: 'auto',
		pointerEvents: 'none',
	},
	// Marks drawn over the video, so they're white and black whatever the theme
	crop: {
		position: 'absolute',
		borderWidth: 2,
		borderStyle: 'solid',
		borderColor: 'white',
		boxShadow: '0 0 0 100vmax rgb(0 0 0 / 55%)',
		pointerEvents: 'none',
	},
	corner: {
		position: 'absolute',
		width: 12,
		height: 12,
		borderWidth: 2,
		borderStyle: 'solid',
		borderColor: 'white',
		borderRadius: '50%',
		backgroundColor: 'black',
		transform: 'translate(-50%, -50%)',
		pointerEvents: 'none',
	},
});

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
	const pointerStart = useRef<Point>(undefined);
	const [draft, setDraft] = useState<FrameCrop>();
	const [crop, setCrop] = useState<FrameCrop>();
	const [corner, setCorner] = useState<Point>();
	const drawPreview = useCallback(
		(canvas: HTMLCanvasElement | null) => {
			canvas?.getContext('2d')?.drawImage(frame, 0, 0);
		},
		[frame],
	);
	const shown = draft ?? crop;
	const selected = crop && !draft && !corner && crop.width >= minSide && crop.height >= minSide ? crop : undefined;
	const xPercent = (x: number) => `${(100 * x) / width}%`;
	const yPercent = (y: number) => `${(100 * y) / height}%`;
	const pointAt = (event: PointerEvent<HTMLDivElement>): Point => {
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
			isOpen
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			width={896}
		>
			<Layout
				height="auto"
				header={
					<DialogHeader
						title="Crop to one camera view"
						subtitle="Only tags in the cropped area are used."
						onOpenChange={onClose}
					/>
				}
				content={
					<LayoutContent>
						<VStack gap={2}>
							<div
								{...stylex.props(styles.frame)}
								style={{ width: `min(100%, ${((width / height) * 58).toString()}dvh)` }}
								onPointerDown={(event) => {
									if (event.isPrimary && event.button === 0) {
										event.currentTarget.setPointerCapture(event.pointerId);
										pointerStart.current = pointAt(event);
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
							>
								<canvas
									ref={drawPreview}
									width={width}
									height={height}
									role="img"
									aria-label="Video frame to crop"
									aria-describedby={hint}
									{...stylex.props(styles.canvas)}
								/>
								{shown && (
									<span
										{...stylex.props(styles.crop)}
										style={{
											left: xPercent(shown.x),
											top: yPercent(shown.y),
											width: xPercent(shown.width),
											height: yPercent(shown.height),
										}}
									/>
								)}
								{corner && (
									<span
										{...stylex.props(styles.corner)}
										style={{ left: xPercent(corner.x), top: yPercent(corner.y) }}
									/>
								)}
							</div>
							<Text id={hint} type="supporting" color="secondary" display="block" xstyle={styles.hint}>
								Drag a box or select two opposite corners.
							</Text>
							<VisuallyHidden role="status">
								{selected ? 'Crop selected.' : corner ? 'Pick the opposite corner.' : ''}
							</VisuallyHidden>
						</VStack>
					</LayoutContent>
				}
				footer={
					<LayoutFooter>
						<HStack gap={2} hAlign="end">
							<Button label="Cancel" variant="ghost" onClick={onClose} />
							<Button
								label="Match field view"
								variant="primary"
								isDisabled={selected === undefined}
								onClick={() => {
									if (selected) {
										onMatch(selected);
									}
								}}
							/>
						</HStack>
					</LayoutFooter>
				}
			/>
		</Dialog>
	);
}
