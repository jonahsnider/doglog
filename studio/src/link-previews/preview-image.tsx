import { render } from 'takumi-js';
import { colors, headingFont, logoUrl, previewImageSize, renderOptions } from '@/link-previews/preview-style';

const safePadding = 72;

/** The generic image centers the Studio wordmark. Shared links center the team name instead. */
export function renderPreviewImage(teamName?: string): Promise<Uint8Array<ArrayBuffer>> {
	const name = teamName?.replaceAll(/\s+/gu, ' ').replace(/^(.{89}).{2,}$/u, '$1…');
	const brandedCorner = name !== undefined;
	const logoSize = brandedCorner ? 48 : 160;
	return render(
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				position: 'relative',
				width: '100%',
				height: '100%',
				padding: safePadding,
				backgroundColor: colors.pane,
				color: colors.text,
				fontFamily: headingFont,
				fontWeight: 600,
			}}
		>
			{name !== undefined && (
				<div
					style={{
						fontSize: name.length > 48 ? 60 : 76,
						lineHeight: 1.05,
						textAlign: 'center',
						minWidth: 0,
						overflowWrap: 'anywhere',
					}}
				>
					{name}
				</div>
			)}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: brandedCorner ? 12 : 36,
					fontSize: brandedCorner ? 32 : 112,
					...(brandedCorner && { position: 'absolute', left: safePadding, bottom: safePadding }),
				}}
			>
				<img src={logoUrl} width={logoSize} height={logoSize} alt="" />
				DogLog Studio
			</div>
		</div>,
		{ ...previewImageSize, ...renderOptions, format: 'png' },
	);
}
