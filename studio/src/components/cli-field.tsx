import { Button } from '@astryxdesign/core/Button';
import { Code } from '@astryxdesign/core/Code';
import { VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { AgentsField } from '@/components/agents-field';
import { toastManager } from '@/components/toast';

/** Other platforms install the `doglog` command with the app */
const canInstallCli = STUDIO_DESKTOP && navigator.userAgent.includes('Mac');

/** Whether the `doglog` command is installed for this copy of Studio, or is something else, ex. a copy that was moved */
type CliStatus = 'missing' | 'installed' | 'other';

const cliStatusDescriptions: Record<CliStatus, string> = {
	missing: 'Open logs from a terminal with',
	installed: 'Installed, open logs from a terminal with',
	other: "doglog doesn't open this copy of Studio, reinstall to fix it. Open logs from a terminal with",
};

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

/** Settings to install the `doglog` command and add Studio to coding agents */
export function CliField() {
	if (canInstallCli) {
		return <CliInstall />;
	}
	return STUDIO_DESKTOP ? <AgentsField /> : null;
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
		<>
			<VStack gap={2} hAlign="start">
				<Text type="label">Terminal command</Text>
				<Text type="supporting" color="secondary">
					{cliStatusDescriptions[status]} <Code>doglog match.wpilog</Code>
				</Text>
				<Button
					label={`${status === 'missing' ? 'Install' : 'Reinstall'} doglog command`}
					size="sm"
					clickAction={async () => {
						if (await installCli()) {
							setStatus('installed');
						}
					}}
				/>
			</VStack>
			{/* Agents run the command, so it has to open this copy of Studio */}
			{status === 'installed' && <AgentsField />}
		</>
	);
}
