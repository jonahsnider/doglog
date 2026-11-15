import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings')({
	component: Settings,
});

function Settings() {
	return (
		<div className="p-6">
			<h1 className="font-heading text-2xl font-semibold">Settings</h1>
		</div>
	);
}
