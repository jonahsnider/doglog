import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { Field } from '@astryxdesign/core/Field';
import { HStack, Layout, LayoutContent, VStack } from '@astryxdesign/core/Layout';
import { Link } from '@astryxdesign/core/Link';
import { NumberInput } from '@astryxdesign/core/NumberInput';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import SettingsIcon from 'lucide-react/icons/settings';
import { useRef, useState } from 'react';
import { useSwipeToClose } from '@/hooks/use-swipe-to-close';
import { getRobotHost } from '@/robot-target';
import { useSettings } from '@/settings';
import { addDemoMatch, resetDemo, updateDemo, useDemo } from '@/sync/demo';
import { syncNow, useSyncFolder } from '@/sync/sync';
import { updateSyncSettings, useSyncSettings } from '@/sync/sync-settings';

/** A button that opens the log sync settings in a drawer */
export function SyncSettingsDrawer() {
	const [open, setOpen] = useState(false);
	const drawerRef = useRef<HTMLDialogElement>(null);
	useSwipeToClose(drawerRef, { isOpen: open, side: 'end', onClose: () => setOpen(false) });
	return (
		<>
			<Button label="Sync settings" variant="ghost" size="sm" icon={<SettingsIcon />} onClick={() => setOpen(true)} />
			<Drawer ref={drawerRef} isOpen={open} onOpenChange={setOpen} label="Sync settings">
				<Layout
					header={<DrawerHeader title="Sync settings" subtitle={<RobotSummary />} onOpenChange={setOpen} />}
					content={
						<LayoutContent>
							<SyncSettingsForm />
						</LayoutContent>
					}
				/>
			</Drawer>
		</>
	);
}

function RobotSummary() {
	const { demo } = useSyncSettings();
	const { robotTarget } = useSettings();
	const target = robotTarget.trim();
	let summary = `Syncs from ${/^\d+$/u.test(target) ? `team ${target}` : target}. `;
	if (demo) {
		summary = 'Syncs from the demo robot. ';
	} else if (getRobotHost(robotTarget) === undefined) {
		summary = 'No robot is set. ';
	}
	return (
		<>
			{summary}
			<Link href="/settings" type="inherit">
				Change the robot in Settings
			</Link>
		</>
	);
}

function SyncSettingsForm() {
	const { folder, days, officialOnly, capGb, demo } = useSyncSettings();
	const folderPath = useSyncFolder()?.path;

	const changeFolder = async () => {
		const picked = await openDialog({ directory: true, defaultPath: folderPath });
		if (picked !== null) {
			updateSyncSettings({ folder: picked });
		}
	};

	return (
		<VStack gap={6}>
			<Field label="Folder" inputID="sync-folder" isGroupLabel>
				<VStack gap={2}>
					<Text type="code" color="secondary" maxLines={1}>
						{folderPath ?? ''}
					</Text>
					<HStack gap={2}>
						<Button label="Change" size="sm" onClick={() => void changeFolder()} />
						{folder !== null && (
							<Button
								label="Use default"
								variant="ghost"
								size="sm"
								onClick={() => updateSyncSettings({ folder: null })}
							/>
						)}
					</HStack>
				</VStack>
			</Field>

			<NumberInput
				label="Days of logs"
				description="Only sync logs from this many days ago or newer"
				value={days}
				min={1}
				isIntegerOnly
				hasNumberSteppers
				width={160}
				onChange={(value) => updateSyncSettings({ days: value })}
			/>

			<Switch
				label="Only official matches"
				description="Skip logs from outside matches run by the field, like practice in the pits"
				value={officialOnly}
				onChange={(checked) => updateSyncSettings({ officialOnly: checked })}
			/>

			<VStack gap={2}>
				<Switch
					label="Limit storage"
					description="Permanently deletes the oldest logs in the folder to stay under the limit"
					value={capGb !== null}
					onChange={(checked) => updateSyncSettings({ capGb: checked ? 20 : null })}
				/>
				{capGb !== null && (
					<NumberInput
						label="Storage limit"
						isLabelHidden
						value={capGb}
						min={1}
						units="GB"
						hasNumberSteppers
						width={160}
						onChange={(value) => updateSyncSettings({ capGb: value })}
					/>
				)}
			</VStack>

			{import.meta.env.DEV && (
				<>
					<Divider />
					<Switch
						label="Demo mode"
						description="Pretends to sync from a robot with made-up logs, without saving anything. Only in development builds."
						value={demo}
						onChange={(checked) => updateSyncSettings({ demo: checked })}
					/>
					{demo && <DemoControls />}
				</>
			)}
		</VStack>
	);
}

function DemoControls() {
	const { reachable, robotEnabled, failNextCopy } = useDemo();

	return (
		<VStack gap={4}>
			<Switch label="Robot reachable" value={reachable} onChange={(checked) => updateDemo({ reachable: checked })} />
			<Switch
				label="Robot enabled"
				value={robotEnabled}
				onChange={(checked) => updateDemo({ robotEnabled: checked })}
			/>
			<HStack wrap="wrap" gap={2}>
				<Button
					label="Add a match log"
					size="sm"
					onClick={() => {
						addDemoMatch();
						syncNow();
					}}
				/>
				<Button
					label="Fail the next copy"
					size="sm"
					isDisabled={failNextCopy}
					onClick={() => updateDemo({ failNextCopy: true })}
				/>
				<Button
					label="Reset"
					variant="ghost"
					size="sm"
					onClick={() => {
						resetDemo();
						syncNow();
					}}
				/>
			</HStack>
		</VStack>
	);
}
