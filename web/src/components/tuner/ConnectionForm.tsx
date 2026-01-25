import { useState, useCallback } from 'react';

interface ConnectionFormProps {
	status: 'disconnected' | 'connecting' | 'connected';
	onConnect: (ip: string) => void;
	onDisconnect: () => void;
	error: string | null;
}

export function ConnectionForm({ status, onConnect, onDisconnect, error }: ConnectionFormProps) {
	const [ip, setIp] = useState('');

	const handleConnect = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (!ip) return;
			onConnect(ip);
		},
		[ip, onConnect]
	);

	const statusColor =
		status === 'connected'
			? 'bg-green-500'
			: status === 'connecting'
				? 'bg-yellow-500'
				: 'bg-gray-400';

	const statusText =
		status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected';

	return (
		<div className="rounded-lg border border-[var(--sl-color-gray-5)] bg-[var(--sl-color-gray-6)] p-4">
			<div className="mb-4 flex items-center gap-3">
				<span className={`h-3 w-3 rounded-full ${statusColor}`} aria-hidden="true" />
				<span className="font-medium text-[var(--sl-color-white)]">{statusText}</span>
			</div>

			<form onSubmit={handleConnect} className="flex gap-3">
				<input
					type="text"
					value={ip}
					onChange={(e) => setIp(e.target.value)}
					placeholder="Robot IP (e.g., 10.5.81.2)"
					className="flex-1 rounded-md border border-[var(--sl-color-gray-5)] bg-[var(--sl-color-black)] px-4 py-2 text-[var(--sl-color-white)] placeholder-[var(--sl-color-gray-3)] focus:border-[var(--sl-color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--sl-color-accent)]"
					disabled={status !== 'disconnected'}
				/>

				{status === 'disconnected' ? (
					<button
						type="submit"
						className="rounded-md bg-[var(--sl-color-accent)] px-6 py-2 font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!ip}
					>
						Connect
					</button>
				) : (
					<button
						type="button"
						onClick={onDisconnect}
						className="rounded-md bg-[var(--sl-color-gray-4)] px-6 py-2 font-medium text-white transition-colors hover:bg-[var(--sl-color-gray-3)]"
					>
						Disconnect
					</button>
				)}
			</form>

			{error && (
				<div className="mt-4 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-red-400">
					{error}
				</div>
			)}

			<p className="mt-4 text-sm text-[var(--sl-color-gray-3)]">
				Enter your robot's IP address to connect. Make sure your robot is powered on and you're on the
				same network.
			</p>
		</div>
	);
}
