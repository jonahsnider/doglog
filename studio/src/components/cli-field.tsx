import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { toastManager } from '@/components/ui/toast';

/** Other platforms install the `doglog` command with the app */
const canInstallCli = isTauri() && navigator.userAgent.includes('Mac');

/** Whether the `doglog` command is installed for this copy of Studio, or is something else, ex. a copy that was moved */
type CliStatus = 'missing' | 'installed' | 'other';

const cliStatusDescriptions: Record<CliStatus, string> = {
	missing: 'Open logs from a terminal with',
	installed: 'Installed, open logs from a terminal with',
	other: "doglog doesn't open this copy of Studio, reinstall to fix it. Open logs from a terminal with",
};

/** Install the `doglog` command, returning whether it was installed */
async function installCli(): Promise<boolean> {
	try {
		await invoke('install_cli');
	} catch (error) {
		// -128 is the user canceling the password prompt
		if (!String(error).includes('(-128)')) {
			toastManager.add({ type: 'error', title: "Couldn't install the doglog command", description: String(error) });
		}
		return false;
	}
	toastManager.add({ type: 'success', title: 'Installed the doglog command' });
	return true;
}

/** Settings field to install the `doglog` command */
export function CliField() {
	return canInstallCli ? <CliInstall /> : null;
}

function CliInstall() {
	const [status, setStatus] = useState<CliStatus>();

	useEffect(() => {
		void invoke<CliStatus>('cli_status').then(setStatus);
	}, []);

	if (status === undefined) {
		return null;
	}

	return (
		<Field name="cli">
			<FieldLabel>Terminal command</FieldLabel>
			<div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void installCli().then((installed) => installed && setStatus('installed'))}
				>
					{status === 'missing' ? 'Install' : 'Reinstall'} doglog command
				</Button>
			</div>
			<FieldDescription>
				{cliStatusDescriptions[status]} <code className="font-mono">doglog match.wpilog</code>
			</FieldDescription>
		</Field>
	);
}
