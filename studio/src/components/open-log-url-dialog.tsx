import { openUrl } from '@tauri-apps/plugin-opener';
import { useRef, useState } from 'react';
import { openLogUrlDialog } from '@/components/open-log-url-dialog-handle';
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
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { type OpenLogUrlError, openLogUrl } from '@/data/open-log-url';

export function OpenLogUrlDialog() {
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
					openLogUrlDialog.close();
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

	return (
		<Dialog
			handle={openLogUrlDialog}
			onOpenChange={(open) => {
				if (!open) {
					reset();
				}
			}}
		>
			<DialogPopup className="max-w-md" bottomStickOnMobile={false}>
				<form className="contents" onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Open log from URL</DialogTitle>
						<DialogDescription>
							Enter the URL of a <span className="font-mono">.wpilog</span> or{' '}
							<span className="font-mono">.wpilogxz</span> file.
						</DialogDescription>
					</DialogHeader>
					<DialogPanel>
						<Field invalid={error !== undefined}>
							<FieldLabel>Log URL</FieldLabel>
							<Input
								autoFocus
								type="text"
								inputMode="url"
								autoComplete="url"
								spellCheck={false}
								placeholder="https://example.com/match.wpilog"
								value={value}
								disabled={submitting}
								onChange={(event) => {
									setValue(event.target.value);
									if (error !== undefined) {
										setError(undefined);
									}
								}}
							/>
							{error !== undefined && (
								<FieldError match>
									<span>{error.message}</span>
									{offerBrowser && (
										<>
											{' '}
											<button
												type="button"
												className="underline underline-offset-2 hover:text-foreground"
												onClick={() => void openUrl(error.url!)}
											>
												Open in browser
											</button>
										</>
									)}
								</FieldError>
							)}
						</Field>
					</DialogPanel>
					<DialogFooter>
						<DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
						<Button type="submit" disabled={submitting || value.trim() === ''}>
							{submitting ? 'Opening…' : 'Open'}
						</Button>
					</DialogFooter>
				</form>
			</DialogPopup>
		</Dialog>
	);
}
