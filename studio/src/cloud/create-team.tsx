import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { type SubmitEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api } from '../../../cloud/convex/_generated/api.js';

export function CreateTeam() {
	const createTeam = useMutation(api.teams.create);
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string>();

	async function create(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (creating) {
			return;
		}
		const value = new FormData(event.currentTarget).get('name');
		const name = typeof value === 'string' ? value.trim() : '';
		if (name === '') {
			setCreateError('Enter a team name.');
			return;
		}
		setCreateError(undefined);
		setCreating(true);
		try {
			await createTeam({ name });
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
		<form className="grid gap-3" onSubmit={(event) => void create(event)}>
			<Field name="name" invalid={createError !== undefined}>
				<FieldLabel>Team name</FieldLabel>
				<Input name="name" autoComplete="off" required />
				<FieldError match role="alert">
					{createError}
				</FieldError>
			</Field>
			<Button type="submit" className="justify-self-start" loading={creating}>
				Create team
			</Button>
		</form>
	);
}
