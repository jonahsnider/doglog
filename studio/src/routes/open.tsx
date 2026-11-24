import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import DownloadIcon from 'lucide-react/icons/download';
import ExternalLinkIcon from 'lucide-react/icons/external-link';
import LinkIcon from 'lucide-react/icons/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { toastManager } from '@/components/toast';
import { buildOpenLogDeepLink, initialLogLabel, normalizeLogUrl } from '@/data/log-url';
import { type OpenLogUrlError, openLogUrl } from '@/data/open-log-url';
import { closeLog } from '@/data/source';

type BrowserKind = 'chromium' | 'other' | 'mobile';

function detectBrowser(): BrowserKind {
	if (navigator.userAgentData) {
		return navigator.userAgentData.mobile ? 'mobile' : 'chromium';
	}
	// iPadOS Safari reports itself as a Mac, but Macs have no touchscreen
	const mobile =
		/Android|iPhone|iPad/u.test(navigator.userAgent) ||
		(navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 0);
	return mobile ? 'mobile' : 'other';
}

type OpenState = { status: 'loading' } | { status: 'handoff' } | { status: 'error'; error: OpenLogUrlError };

export const Route = createFileRoute('/open')({
	validateSearch: (search: Record<string, unknown>): { url?: string } => ({
		url: typeof search['url'] === 'string' ? search['url'] : undefined,
	}),
	component: OpenLogRoute,
});

function OpenLogRoute() {
	const { url: rawUrl } = Route.useSearch();
	const normalized = rawUrl === undefined ? undefined : normalizeLogUrl(rawUrl);

	if (normalized === undefined) {
		return (
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<LinkIcon />
					</EmptyMedia>
					<EmptyTitle>Couldn’t open log link</EmptyTitle>
					<EmptyDescription>
						{rawUrl === undefined || rawUrl.trim() === ''
							? 'The link is missing a log URL.'
							: 'The link does not contain a valid http:// or https:// URL.'}
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button render={<Link to="/" replace />}>Back to dashboards</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return <OpenValidLogUrl key={normalized.href} url={normalized.href} />;
}

function OpenValidLogUrl({ url }: { url: string }) {
	const router = useRouter();
	const [state, setState] = useState<OpenState>({ status: 'loading' });
	const [attempt, setAttempt] = useState(0);
	const handedOffRef = useRef(false);
	const browser = STUDIO_DESKTOP ? 'mobile' : detectBrowser();
	const desktopBrowser = !STUDIO_DESKTOP && browser !== 'mobile';
	const deepLink = buildOpenLogDeepLink(url);
	const label = initialLogLabel(url);

	useEffect(() => {
		let active = true;
		let streamingStarted = false;
		let toastId: string | undefined;
		let blurTimeout: number | undefined;
		let blurListener: (() => void) | undefined;
		let focusListener: (() => void) | undefined;
		const controller = new AbortController();

		const abortFetch = () => {
			controller.abort();
			if (streamingStarted) {
				closeLog();
			}
		};

		const dismissToast = () => {
			if (toastId !== undefined) {
				toastManager.close(toastId);
				toastId = undefined;
			}
		};

		const cleanupHandoffListeners = () => {
			if (blurTimeout !== undefined) {
				clearTimeout(blurTimeout);
				blurTimeout = undefined;
			}
			if (blurListener !== undefined) {
				removeEventListener('blur', blurListener);
				blurListener = undefined;
			}
			if (focusListener !== undefined) {
				removeEventListener('focus', focusListener);
				focusListener = undefined;
			}
		};

		// Desktop handoff only runs on the initial visit (attempt === 0), not on manual/focus retries
		if (attempt === 0 && !STUDIO_DESKTOP) {
			if (browser === 'chromium') {
				blurListener = () => {
					cleanupHandoffListeners();
					handedOffRef.current = true;
					abortFetch();
					if (active) {
						setState({ status: 'handoff' });
						// If the user returns to this tab (ex. clicked Cancel in Chrome's dialog), restart the browser fetch
						focusListener = () => {
							cleanupHandoffListeners();
							if (active) {
								setState({ status: 'loading' });
								setAttempt((count) => count + 1);
							}
						};
						addEventListener('focus', focusListener, { once: true });
					}
				};
				addEventListener('blur', blurListener, { once: true });
				blurTimeout = window.setTimeout(() => {
					if (blurListener !== undefined) {
						removeEventListener('blur', blurListener);
						blurListener = undefined;
					}
					blurTimeout = undefined;
				}, 500);
				location.assign(deepLink);
			} else if (browser === 'other') {
				toastId = toastManager.add({
					title: 'Open in the desktop app?',
					actionProps: {
						children: 'Open',
						onClick: () => {
							abortFetch();
							location.assign(deepLink);
						},
					},
				});
			}
		}

		void (async () => {
			const result = await openLogUrl(url, { signal: controller.signal, showToast: false });
			if (!active) {
				return;
			}
			if (result.ok) {
				streamingStarted = true;
				cleanupHandoffListeners();
				await router.navigate({ to: '/', replace: true });
				return;
			}
			if (result.error.kind === 'aborted') {
				return;
			}
			cleanupHandoffListeners();
			dismissToast();
			setState({ status: 'error', error: result.error });
		})();

		return () => {
			active = false;
			cleanupHandoffListeners();
			// Only abort if we're leaving before streaming handed off to the active log store
			if (!streamingStarted) {
				controller.abort();
			}
		};
	}, [attempt, browser, deepLink, router, url]);

	if (state.status === 'handoff') {
		return (
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<ExternalLinkIcon />
					</EmptyMedia>
					<EmptyTitle>Opening in DogLog Studio</EmptyTitle>
					<EmptyDescription>
						Trying to open <span className="font-mono">{label}</span> in the desktop app.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent className="flex-row flex-wrap justify-center gap-2">
					<Button
						onClick={() => {
							setState({ status: 'loading' });
							setAttempt((count) => count + 1);
						}}
					>
						Open in browser
					</Button>
					<Button variant="outline" render={<Link to="/" replace />}>
						Back to dashboards
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	if (state.status === 'error') {
		return (
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<LinkIcon />
					</EmptyMedia>
					<EmptyTitle>Couldn’t open {label}</EmptyTitle>
					<EmptyDescription>{state.error.message}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent className="flex-row flex-wrap justify-center gap-2">
					{desktopBrowser && (
						<Button onClick={() => location.assign(deepLink)}>
							<ExternalLinkIcon />
							Open in desktop app
						</Button>
					)}
					<Button
						variant={desktopBrowser ? 'outline' : 'default'}
						render={<a href={url} target="_blank" rel="noopener noreferrer" aria-label="Download file" />}
					>
						<DownloadIcon />
						Download file
					</Button>
					<Button variant="ghost" render={<Link to="/" replace />}>
						Back to dashboards
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<Empty className="h-full">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Spinner />
				</EmptyMedia>
				<EmptyTitle>Opening {label}…</EmptyTitle>
				<EmptyDescription>Connecting to download the log file.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="outline" render={<Link to="/" replace />}>
					Cancel
				</Button>
			</EmptyContent>
		</Empty>
	);
}
