import { Button } from '@astryxdesign/core/Button';
import { Code } from '@astryxdesign/core/Code';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useSelector } from '@tanstack/react-store';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useRef, useState } from 'react';
import { openLogUrlDialogOpen } from '@/components/open-log-url-dialog-handle';
import { type OpenLogUrlError, openLogUrl } from '@/data/open-log-url';

export function OpenLogUrlDialog() {
	const open = useSelector(openLogUrlDialogOpen);
	const [value, setValue] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<OpenLogUrlError>();
	const abortRef = useRef<AbortController | undefined>(undefined);

	const reset = () => {
		abortRef.current?.abort();
		abortRef.current = undefined;
		setValue('');
		setSubmitting(false);
		setError(undefined);
	};

	const handleSubmit = (event: { preventDefault: () => void }) => {
		event.preventDefault();
		if (submitting) {
			return;
		}
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setSubmitting(true);
		setError(undefined);

		void openLogUrl(value, { signal: controller.signal, showToast: false })
			.then((result) => {
				if (abortRef.current !== controller) {
					return undefined;
				}
				if (result.ok) {
					setValue('');
					setError(undefined);
					openLogUrlDialogOpen.set(false);
				} else if (result.error.kind !== 'aborted') {
					setError(result.error);
				}
				return undefined;
			})
			.finally(() => {
				if (abortRef.current === controller) {
					abortRef.current = undefined;
					setSubmitting(false);
				}
			});
	};

	const offerBrowser = STUDIO_DESKTOP && (error?.kind === 'html' || error?.kind === 'auth') && error.url !== undefined;
	const setOpen = (next: boolean) => {
		if (!next) {
			reset();
		}
		openLogUrlDialogOpen.set(next);
	};

	return (
		<Dialog isOpen={open} onOpenChange={setOpen} purpose="form" width={448}>
			<form onSubmit={handleSubmit}>
				<Layout
					height="auto"
					header={
						<DialogHeader
							title="Open log from URL"
							subtitle={
								<>
									Enter the URL of a <Code>.wpilog</Code> or <Code>.wpilogxz</Code> file.
								</>
							}
							onOpenChange={setOpen}
						/>
					}
					content={
						<LayoutContent>
							<VStack gap={2} hAlign="start">
								<TextInput
									label="Log URL"
									hasAutoFocus
									inputMode="url"
									autoComplete="url"
									hasSpellCheck={false}
									placeholder="https://example.com/match.wpilog"
									value={value}
									isDisabled={submitting}
									width="100%"
									status={error === undefined ? undefined : { type: 'error', message: error.message }}
									onChange={(next) => {
										setValue(next);
										if (error !== undefined) {
											setError(undefined);
										}
									}}
								/>
								{offerBrowser && (
									<Button label="Open in browser" variant="ghost" size="sm" onClick={() => void openUrl(error.url!)} />
								)}
							</VStack>
						</LayoutContent>
					}
					footer={
						<LayoutFooter>
							<HStack gap={2} hAlign="end">
								<Button label="Cancel" variant="ghost" onClick={() => setOpen(false)} />
								<Button
									type="submit"
									label="Open"
									variant="primary"
									isLoading={submitting}
									isDisabled={value.trim() === ''}
								/>
							</HStack>
						</LayoutFooter>
					}
				/>
			</form>
		</Dialog>
	);
}
