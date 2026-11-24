import { Button } from '@astryxdesign/core/Button';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { HStack } from '@astryxdesign/core/Layout';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { type SubmitEvent, useState } from 'react';
import { api } from '../../../cloud/convex/_generated/api.js';

export function CreateTeam() {
	const createTeam = useMutation(api.teams.create);
	const [name, setName] = useState('');
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string>();

	async function create(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (creating) {
			return;
		}
		if (name.trim() === '') {
			setCreateError('Enter a team name.');
			return;
		}
		setCreateError(undefined);
		setCreating(true);
		try {
			await createTeam({ name: name.trim() });
		} catch (error) {
			setCreateError(
				error instanceof ConvexError && typeof error.data === 'string'
					? error.data
					: 'Couldn’t create the team. Try again.',
			);
		}
		setCreating(false);
	}

	return (
		<form onSubmit={(event) => void create(event)}>
			<FormLayout>
				<TextInput
					label="Team name"
					value={name}
					onChange={setName}
					autoComplete="off"
					isRequired
					status={createError === undefined ? undefined : { type: 'error', message: createError }}
				/>
				<HStack>
					<Button type="submit" label="Create team" variant="primary" isLoading={creating} />
				</HStack>
			</FormLayout>
		</form>
	);
}
