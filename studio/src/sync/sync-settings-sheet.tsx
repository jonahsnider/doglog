import { Link } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
	NumberField,
	NumberFieldDecrement,
	NumberFieldGroup,
	NumberFieldIncrement,
	NumberFieldInput,
} from '@/components/ui/number-field';
import {
	Sheet,
	SheetDescription,
	SheetHeader,
	SheetPanel,
	SheetPopup,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { getRobotHost } from '@/robot-target';
import { useSettings } from '@/settings';
import { addDemoMatch, resetDemo, updateDemo, useDemo } from '@/sync/demo';
import { syncNow, useSyncFolder } from '@/sync/sync';
import { updateSyncSettings, useSyncSettings } from '@/sync/sync-settings';

export function SyncSettingsSheet({ trigger }: { trigger: ReactElement }) {
	const { folder, days, officialOnly, capGb, demo } = useSyncSettings();
	const { robotTarget } = useSettings();
	const folderPath = useSyncFolder()?.path;

	const changeFolder = async () => {
		const picked = await openDialog({ directory: true, defaultPath: folderPath });
		if (picked !== null) {
			updateSyncSettings({ folder: picked });
		}
	};

	return (
		<Sheet>
			<SheetTrigger render={trigger} />
			<SheetPopup>
				<SheetHeader>
					<SheetTitle>Sync settings</SheetTitle>
					<SheetDescription>
						{demo ? (
							'Syncs from the demo robot. '
						) : getRobotHost(robotTarget) === undefined ? (
							'No robot is set. '
						) : (
							<>Syncs from {/^\d+$/u.test(robotTarget.trim()) ? `team ${robotTarget.trim()}` : robotTarget.trim()}. </>
						)}
						<Link to="/settings" className="underline underline-offset-4">
							Change the robot in Settings
						</Link>
					</SheetDescription>
				</SheetHeader>
				<SheetPanel className="flex flex-col gap-6">
					<Field name="syncFolder">
						<FieldLabel>Folder</FieldLabel>
						<span className="w-full truncate font-mono text-sm text-muted-foreground" title={folderPath}>
							{folderPath}
						</span>
						<div className="flex gap-2">
							<Button variant="outline" size="sm" onClick={() => void changeFolder()}>
								Change
							</Button>
							{folder !== null && (
								<Button variant="ghost" size="sm" onClick={() => updateSyncSettings({ folder: null })}>
									Use default
								</Button>
							)}
						</div>
					</Field>

					<Field name="syncDays">
						<FieldLabel>Days of logs</FieldLabel>
						<NumberField
							value={days}
							min={1}
							step={1}
							onValueChange={(value) => {
								if (value !== null) {
									updateSyncSettings({ days: Math.round(value) });
								}
							}}
							className="w-32"
						>
							<NumberFieldGroup>
								<NumberFieldDecrement />
								<NumberFieldInput />
								<NumberFieldIncrement />
							</NumberFieldGroup>
						</NumberField>
						<FieldDescription>Only sync logs from this many days ago or newer</FieldDescription>
					</Field>

					<Field name="syncOfficialOnly">
						<FieldLabel>
							<Switch
								checked={officialOnly}
								onCheckedChange={(checked) => updateSyncSettings({ officialOnly: checked })}
							/>
							Only official matches
						</FieldLabel>
						<FieldDescription>
							Skip logs from outside matches run by the field, like practice in the pits
						</FieldDescription>
					</Field>

					<Field name="syncCap">
						<FieldLabel>
							<Switch
								checked={capGb !== null}
								onCheckedChange={(checked) => updateSyncSettings({ capGb: checked ? 20 : null })}
							/>
							Limit storage
						</FieldLabel>
						{capGb !== null && (
							<NumberField
								value={capGb}
								min={1}
								step={1}
								format={{ style: 'unit', unit: 'gigabyte' }}
								onValueChange={(value) => {
									if (value !== null) {
										updateSyncSettings({ capGb: value });
									}
								}}
								className="w-40"
							>
								<NumberFieldGroup>
									<NumberFieldDecrement />
									<NumberFieldInput />
									<NumberFieldIncrement />
								</NumberFieldGroup>
							</NumberField>
						)}
						<FieldDescription>
							Permanently deletes the oldest logs in the folder to stay under the limit
						</FieldDescription>
					</Field>

					{import.meta.env.DEV && (
						<Field name="syncDemo" className="border-t pt-6">
							<FieldLabel>
								<Switch checked={demo} onCheckedChange={(checked) => updateSyncSettings({ demo: checked })} />
								Demo mode
							</FieldLabel>
							<FieldDescription>
								Pretends to sync from a robot with made-up logs, without saving anything. Only in development builds.
							</FieldDescription>
						</Field>
					)}
					{import.meta.env.DEV && demo && <DemoControls />}
				</SheetPanel>
			</SheetPopup>
		</Sheet>
	);
}

function DemoControls() {
	const { reachable, robotEnabled, failNextCopy } = useDemo();

	return (
		<div className="flex flex-col gap-4">
			<Field name="demoReachable">
				<FieldLabel>
					<Switch checked={reachable} onCheckedChange={(checked) => updateDemo({ reachable: checked })} />
					Robot reachable
				</FieldLabel>
			</Field>
			<Field name="demoRobotEnabled">
				<FieldLabel>
					<Switch checked={robotEnabled} onCheckedChange={(checked) => updateDemo({ robotEnabled: checked })} />
					Robot enabled
				</FieldLabel>
			</Field>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						addDemoMatch();
						syncNow();
					}}
				>
					Add a match log
				</Button>
				<Button variant="outline" size="sm" disabled={failNextCopy} onClick={() => updateDemo({ failNextCopy: true })}>
					Fail the next copy
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						resetDemo();
						syncNow();
					}}
				>
					Reset
				</Button>
			</div>
		</div>
	);
}
