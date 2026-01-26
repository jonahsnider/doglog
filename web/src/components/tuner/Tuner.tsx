import { useCallback, useRef, useState } from 'react';
import { NetworkTables, NetworkTablesTypeInfos, NetworkTablesTopic } from 'ntcore-ts-client';
import type { NetworkTablesTypeInfo } from 'ntcore-ts-client';
import { ConnectionForm } from './ConnectionForm';
import { TunablesList } from './TunablesList';

export type TunableValueType = string | number | boolean | number[] | boolean[] | string[];

export interface TunableValue {
	key: string;
	value: TunableValueType;
	type: NetworkTablesTypeInfo;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	topic: NetworkTablesTopic<any>;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// Type for the NetworkTables client instance
type NTClient = ReturnType<typeof NetworkTables.getInstanceByURI>;

export function Tuner() {
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
	const [tunables, setTunables] = useState<Map<string, TunableValue>>(new Map());
	const [error, setError] = useState<string | null>(null);
	const [currentUri, setCurrentUri] = useState<string | null>(null);
	const ntClientRef = useRef<NTClient | null>(null);
	// Track topics that have been set up for publishing
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const topicsRef = useRef<Map<string, NetworkTablesTopic<any>>>(new Map());

	const connect = useCallback(
		(ip: string) => {
			setError(null);
			setConnectionStatus('connecting');
			setTunables(new Map());
			topicsRef.current.clear();

			try {
				// If we have an existing client with a different URI, change it
				// Otherwise create a new one
				let client: NTClient;
				if (ntClientRef.current && currentUri && currentUri !== ip) {
					ntClientRef.current.changeURI(ip, 5810);
					client = ntClientRef.current;
				} else {
					client = NetworkTables.getInstanceByURI(ip, 5810);
					ntClientRef.current = client;
				}
				setCurrentUri(ip);

				// Listen for connection status changes
				client.addRobotConnectionListener((connected) => {
					setConnectionStatus(connected ? 'connected' : 'disconnected');
					if (!connected) {
						setTunables(new Map());
						topicsRef.current.clear();
					}
				});

				// Subscribe to all topics under Tunable/ prefix
				const tunableTopic = client.createPrefixTopic('/Tunable/');

				tunableTopic.subscribe((value, params) => {
					if (value === null) return;

					const key = params.name.replace('/Tunable/', '');

					// Determine the type info based on the NT type string
					let typeInfo: NetworkTablesTypeInfo;
					switch (params.type) {
						case 'boolean':
							typeInfo = NetworkTablesTypeInfos.kBoolean;
							break;
						case 'int':
							typeInfo = NetworkTablesTypeInfos.kInteger;
							break;
						case 'double':
						case 'float':
							typeInfo = NetworkTablesTypeInfos.kDouble;
							break;
						case 'string':
							typeInfo = NetworkTablesTypeInfos.kString;
							break;
						case 'boolean[]':
							typeInfo = NetworkTablesTypeInfos.kBooleanArray;
							break;
						case 'int[]':
							typeInfo = NetworkTablesTypeInfos.kIntegerArray;
							break;
						case 'double[]':
						case 'float[]':
							typeInfo = NetworkTablesTypeInfos.kDoubleArray;
							break;
						case 'string[]':
							typeInfo = NetworkTablesTypeInfos.kStringArray;
							break;
						default:
							// Skip unsupported types
							return;
					}

					// Get or create topic for this specific tunable
					let topic = topicsRef.current.get(params.name);
					if (!topic) {
						topic = client.createTopic<TunableValueType>(params.name, typeInfo);
						topicsRef.current.set(params.name, topic);

						// WORKAROUND: ntcore-ts-client requires server acknowledgement before allowing
						// setValue() to work. Since the robot already owns these topics, it won't send
						// the acknowledgement we need. We work around this by manually setting the
						// library's internal state to mark us as a publisher.
						// See: https://github.com/cjlawson02/ntcore-ts-client
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const announceParams = params as any;
						if (announceParams.id !== undefined) {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							const topicAny = topic as any;
							const pubuid = topicAny.client?.messenger?.getNextPubUID?.() ?? Math.floor(Math.random() * 1000000);

							// Mark the topic as announced with our pubuid
							topic.announce({
								id: announceParams.id,
								name: params.name,
								type: params.type,
								pubuid: pubuid,
								properties: announceParams.properties ?? {},
							});

							// Set internal state to allow setValue() to work
							topicAny._pubuid = pubuid;
							topicAny._publisher = true;
						}
					}

					setTunables((prev) => {
						const next = new Map(prev);
						next.set(key, {
							key,
							value: value as TunableValueType,
							type: typeInfo,
							topic,
						});
						return next;
					});
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to connect');
				setConnectionStatus('disconnected');
			}
		},
		[currentUri],
	);

	const disconnect = useCallback(() => {
		// Note: ntcore-ts-client doesn't expose a cleanup/disconnect method
		// The connection will be maintained but we'll clear our UI state
		// Changing URI to an invalid one effectively "disconnects" for our purposes
		if (ntClientRef.current) {
			// Change to localhost to effectively disconnect from robot
			ntClientRef.current.changeURI('localhost', 5810);
		}
		setConnectionStatus('disconnected');
		setTunables(new Map());
		setError(null);
		setCurrentUri(null);
		ntClientRef.current = null;
	}, []);

	const updateValue = useCallback(
		(key: string, newValue: TunableValueType) => {
			const tunable = tunables.get(key);
			if (!tunable) return;

			// Get the topic from topicsRef which has the proper publish setup
			const topicName = '/Tunable/' + key;
			const topic = topicsRef.current.get(topicName);
			if (!topic) {
				console.error('Topic not found in ref:', topicName);
				return;
			}

			try {
				// Set the value - the topic was set up as a publisher during subscription
				topic.setValue(newValue);

				// Update local state
				setTunables((prev) => {
					const next = new Map(prev);
					next.set(key, { ...tunable, value: newValue });
					return next;
				});
			} catch (err) {
				console.error('Failed to set value:', err);
			}
		},
		[tunables],
	);

	return (
		<div className="tuner-container mt-6 space-y-6">
			<ConnectionForm status={connectionStatus} onConnect={connect} onDisconnect={disconnect} error={error} />

			{connectionStatus === 'connected' && <TunablesList tunables={tunables} onUpdateValue={updateValue} />}
		</div>
	);
}
