import { aboutDialog } from '@/components/about-dialog-handle';
import { Dialog, DialogDescription, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { bundle } from '../../src-tauri/tauri.conf.json';

export function AboutDialog() {
	return (
		<Dialog handle={aboutDialog}>
			<DialogPopup className="max-w-md" bottomStickOnMobile={false}>
				<DialogHeader className="items-center text-center">
					<img src="/logo.svg" alt="" width={64} height={64} />
					<DialogTitle>DogLog Studio</DialogTitle>
					<DialogDescription>{bundle.shortDescription}</DialogDescription>
					<p className="text-muted-foreground text-xs">
						Version {STUDIO_VERSION}
						{STUDIO_COMMIT !== null && (
							<>
								{' '}
								(<span className="font-mono">{STUDIO_COMMIT}</span>)
							</>
						)}
					</p>
				</DialogHeader>
				<DialogPanel>
					<h3 className="border-t pt-4 font-heading font-semibold">Thanks to</h3>
					<ul className="mt-2 list-disc space-y-2.5 ps-5 text-sm marker:text-primary">
						<li>
							<strong className="font-medium">Saikiran Ramanan and Simon P</strong>
							<span className="block text-muted-foreground">Early testing and feedback</span>
						</li>
						<li>
							<strong className="font-medium">Chris Lawson</strong>
							<span className="block text-muted-foreground">ntcore-ts</span>
						</li>
						<li>
							<strong className="font-medium">Connor Horn</strong>
							<span className="block text-muted-foreground">Moral support</span>
						</li>
					</ul>
					<p className="mt-4 border-t pt-4 text-center text-muted-foreground text-xs">{bundle.copyright}</p>
				</DialogPanel>
			</DialogPopup>
		</Dialog>
	);
}
