import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { type SubmitEvent, useState } from 'react';
import { UtilityPageSection } from '@/components/utility-page';
import { api } from '../../../cloud/convex/_generated/api.js';

/** Settings every member's Studio uses until they set their own, which only admins can change */
export function TeamDefaults({ team }: { team: FunctionReturnType<typeof api.teams.getMine> | undefined }) {
	if (!team) {
		return null;
	}
	return (
		<>
			<UtilityPageSection title="Team defaults" description="Settings every member starts with">
				<TeamNumber key={team.id} teamNumber={team.defaults.teamNumber} canEdit={team.role === 'admin'} />
			</UtilityPageSection>
			<Divider />
		</>
	);
}

function TeamNumber({ teamNumber, canEdit }: { teamNumber: number | null; canEdit: boolean }) {
	const updateDefaults = useMutation(api.teams.updateDefaults);
	const [draft, setDraft] = useState<string>();
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string>();
	const current = teamNumber === null ? '' : String(teamNumber);

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (saving || draft === undefined) {
			return;
		}
		setError(undefined);
		setSaving(true);
		try {
			const trimmed = draft.trim();
			await updateDefaults({ teamNumber: trimmed === '' ? null : Number(trimmed) });
			setDraft(undefined);
			setSaved(true);
		} catch (cause) {
			setError(
				cause instanceof ConvexError && typeof cause.data === 'string'
					? cause.data
					: 'Couldn’t save the team number. Try again.',
			);
		}
		setSaving(false);
	}

	return (
		<form onSubmit={(event) => void save(event)}>
			<FormLayout>
				<TextInput
					label="Team number"
					description={
						canEdit
							? 'Members connect to this robot unless they enter another in Settings, like an offseason team number.'
							: 'Members connect to this robot unless they enter another in Settings. Only team admins can change it.'
					}
					value={draft ?? current}
					onChange={(value) => {
						setDraft(value);
						setSaved(false);
					}}
					placeholder="581"
					autoComplete="off"
					hasSpellCheck={false}
					isReadOnly={!canEdit}
					isDisabled={saving}
					status={error === undefined ? undefined : { type: 'error', message: error }}
				/>
				{canEdit && (
					<HStack vAlign="center" wrap="wrap" gap={3}>
						<Button
							type="submit"
							label="Save team number"
							isLoading={saving}
							isDisabled={draft === undefined || draft.trim() === current}
						/>
						{saved && (
							<Text role="status" color="secondary">
								Team number saved.
							</Text>
						)}
					</HStack>
				)}
			</FormLayout>
		</form>
	);
}
