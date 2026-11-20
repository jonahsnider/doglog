// Open Graph images for Studio links: a dashboard's name over a wireframe of its panes, like Studio's own dashboards.
// Free of the browser, so the cloud server can draw dashboard links' images and the build can draw the generic one.
import type { ReactElement } from 'react';
import { measure, render } from 'takumi-js';
import type { Pane, PaneNode } from '@/panes/layout';
import { childSizes } from '@/panes/split-sizes';
import { suggestWidgetName } from '@/dashboards/label';
import { widgetIcons } from '@/widgets/icons';
import { optionValues } from '@/widgets/options';
import { getWidgetInfo } from '@/widgets/widget-info';
import { widgetTitle } from '@/widgets/widget-type';
import { colors, headingFont, logoUrl, previewImageSize, renderOptions } from '@/link-previews/preview-style';

// Sizes the layout and `fitPanes()` both use, in pixels
const imagePadding = 48;
const titleGap = 28;
const splitGap = 10;
const panePaddingX = 22;
const panePaddingY = 18;
const headerIconSize = 30;
const headerGap = 12;
const headerContentGap = 8;
const headerText = { fontFamily: headingFont, fontSize: 28, fontWeight: 600 } as const;
/** Largest first, panes use the largest their contents fit at without more lines than at `contentBaseFontSize` */
const contentFontSizes = [52, 48, 44, 40, 36, 32, 28, 24, 20];
const contentBaseFontSize = 44;
/** Icons shown in place of contents any smaller would be hard to make out */
const minContentIconSize = 48;

/** Pane contents' text, with its font size from `contentFontSizes` */
const contentText = {
	// Full width so it lines up with the pane's header, unlike the icons shown instead
	width: '100%',
	color: colors.text,
	fontWeight: 600,
	lineHeight: 1.2,
	// Only splits words longer than the pane is wide
	overflowWrap: 'break-word',
} as const;

/** Studio's logo and name over the dashboard's name */
function Heading({ title }: { title: string }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 14,
					color: colors.mutedText,
					// Like the app's name in Studio's title bar
					fontFamily: headingFont,
					fontSize: 28,
					fontWeight: 600,
				}}
			>
				<img src={logoUrl} width={40} height={40} alt="" />
				DogLog Studio
			</div>
			<div
				style={{
					fontFamily: headingFont,
					fontSize: 64,
					fontWeight: 600,
					lineHeight: 1.1,
					overflowWrap: 'break-word',
				}}
			>
				{title}
			</div>
		</div>
	);
}

/** A pane's header like Studio shows it: its widget's icon and title. `undefined` for empty panes. */
function paneHeader({ widget }: Pane) {
	const info = widget && getWidgetInfo(widget.type);
	return (
		widget && {
			Icon: info && widgetIcons[info.id],
			title: info ? widgetTitle(info, optionValues(info, widget, [])) : widget.type,
		}
	);
}

/** Height of `element` laid out in a column `width` pixels wide */
async function measureHeight(element: ReactElement, width: number): Promise<number> {
	const measured = await measure(
		<div style={{ display: 'flex', flexDirection: 'column', width }}>{element}</div>,
		renderOptions,
	);
	return measured.children[0]?.height ?? Infinity;
}

/** Each pane with its width and height in the image, given its node's */
function paneSizes(node: PaneNode, width: number, height: number): [Pane, number, number][] {
	if (node.kind === 'pane') {
		return [[node, width, height]];
	}
	const sizes = childSizes(node);
	const row = node.direction === 'row';
	const shared = (row ? width : height) - splitGap * (node.children.length - 1);
	return node.children.flatMap((child, index) => {
		const size = shared * (sizes[index] ?? 0);
		return paneSizes(child, row ? size : width, row ? height : size);
	});
}

/**
 * Whether a pane shows its header, left out when it'd cut off its title or when that's the only way the contents fit,
 * and the font size its contents fit at. Contents that don't fit even then show the widget's icon instead, if there's
 * room for it to be at least `minContentIconSize`.
 */
type PaneFit = { header: boolean; contentFontSize?: number; icon: boolean };

async function fitPane(pane: Pane, width: number, height: number): Promise<[string, PaneFit]> {
	const header = paneHeader(pane);
	const content = pane.widget && suggestWidgetName(pane.widget);
	const innerWidth = width - 2 * panePaddingX;
	const innerHeight = height - 2 * panePaddingY;
	// Height the header takes up with the gap below it, `undefined` when it doesn't fit
	let headerHeight: number | undefined;
	if (header) {
		const text = await measure(<span style={headerText}>{header.title}</span>, renderOptions);
		if ((header.Icon ? headerIconSize + headerGap : 0) + text.width <= innerWidth) {
			headerHeight = Math.max(text.height, headerIconSize) + headerContentGap;
		}
	}

	const sizes = await Promise.all(
		(content === undefined ? [] : contentFontSizes).map(async (fontSize) => {
			const textHeight = await measureHeight(<span style={{ ...contentText, fontSize }}>{content}</span>, innerWidth);
			return { fontSize, textHeight, lines: Math.round(textHeight / (fontSize * contentText.lineHeight)) };
		}),
	);
	const maxLines = sizes.find((size) => size.fontSize === contentBaseFontSize)?.lines ?? Infinity;
	// Below the header if it fits, then in the whole pane
	for (const room of headerHeight === undefined ? [innerHeight] : [innerHeight - headerHeight, innerHeight]) {
		const fit = sizes.find((size) => size.textHeight <= room && size.lines <= maxLines);
		if (fit) {
			return [pane.id, { header: room < innerHeight, contentFontSize: fit.fontSize, icon: false }];
		}
	}
	return [
		pane.id,
		{ header: headerHeight !== undefined, icon: innerHeight - (headerHeight ?? 0) >= minContentIconSize },
	];
}

/** How each pane fits, by ID, under a heading of `title` */
async function fitPanes(title: string, layout: PaneNode): Promise<Map<string, PaneFit>> {
	const width = previewImageSize.width - 2 * imagePadding;
	const height =
		previewImageSize.height - 2 * imagePadding - titleGap - (await measureHeight(<Heading title={title} />, width));
	return new Map(await Promise.all(paneSizes(layout, width, height).map(([pane, ...size]) => fitPane(pane, ...size))));
}

function PreviewNode({ node, fits }: { node: PaneNode; fits: ReadonlyMap<string, PaneFit> }) {
	if (node.kind === 'pane') {
		const header = paneHeader(node);
		const fit = fits.get(node.id);
		// What the widget shows, or its icon for widgets the header already describes, ex. a notepad
		const content = node.widget && suggestWidgetName(node.widget);
		const Icon = header?.Icon;
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					flexGrow: 1,
					minWidth: 0,
					minHeight: 0,
					overflow: 'hidden',
					gap: headerContentGap,
					padding: `${panePaddingY}px ${panePaddingX}px`,
					borderRadius: 16,
					backgroundColor: colors.pane,
					color: colors.mutedText,
				}}
			>
				{header && fit?.header === true && (
					<div style={{ display: 'flex', alignItems: 'center', gap: headerGap, whiteSpace: 'nowrap', ...headerText }}>
						{Icon && <Icon width={headerIconSize} height={headerIconSize} style={{ flexShrink: 0 }} />}
						{header.title}
					</div>
				)}
				<div style={{ display: 'flex', flexGrow: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
					{fit?.contentFontSize === undefined ? (
						// Up to 96 px, smaller in short panes so it isn't cut off
						Icon &&
						fit?.icon === true && (
							<Icon style={{ width: 'auto', height: '100%', maxHeight: 96, aspectRatio: 1, opacity: 0.5 }} />
						)
					) : (
						<span style={{ ...contentText, fontSize: fit.contentFontSize }}>{content}</span>
					)}
				</div>
			</div>
		);
	}

	const sizes = childSizes(node);
	return (
		<div
			style={{
				display: 'flex',
				flexGrow: 1,
				flexDirection: node.direction,
				minWidth: 0,
				minHeight: 0,
				gap: splitGap,
			}}
		>
			{node.children.map((child, index) => (
				// Basis 0 so each child's share of the space matches its size
				<div key={child.id} style={{ display: 'flex', flex: `${sizes[index]} 1 0`, minWidth: 0, minHeight: 0 }}>
					<PreviewNode node={child} fits={fits} />
				</div>
			))}
		</div>
	);
}

/** A PNG with Studio's logo, a title, and a wireframe of `layout` */
export async function renderPreviewImage({
	title,
	layout,
}: {
	title: string;
	layout: PaneNode;
}): Promise<Uint8Array<ArrayBuffer>> {
	const fits = await fitPanes(title, layout);
	return render(
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				height: '100%',
				gap: titleGap,
				padding: imagePadding,
				backgroundColor: colors.frame,
				color: colors.text,
				fontFamily: 'IBM Plex Sans',
			}}
		>
			<Heading title={title} />
			<PreviewNode node={layout} fits={fits} />
		</div>,
		{ ...previewImageSize, ...renderOptions, format: 'png' },
	);
}

/** The image for every other Studio link, ex. the home page: Studio's logo and name, centered */
export function renderGenericPreviewImage(): Promise<Uint8Array<ArrayBuffer>> {
	return render(
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 36,
				width: '100%',
				height: '100%',
				// Studio's background, which panes use too
				backgroundColor: colors.pane,
				color: colors.text,
				fontFamily: headingFont,
				fontSize: 112,
				fontWeight: 600,
			}}
		>
			<img src={logoUrl} width={160} height={160} alt="" />
			DogLog Studio
		</div>,
		{ ...previewImageSize, ...renderOptions, format: 'png' },
	);
}
