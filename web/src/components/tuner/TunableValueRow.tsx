import { useState, useCallback, useEffect } from 'react';
import { NetworkTablesTypeInfos } from 'ntcore-ts-client';
import type { TunableValue, TunableValueType } from './Tuner';

interface TunableValueRowProps {
	tunable: TunableValue;
	onUpdateValue: (key: string, value: TunableValueType) => void;
}

export function TunableValueRow({ tunable, onUpdateValue }: TunableValueRowProps) {
	const isArray = Array.isArray(tunable.value);
	const isNumberArray =
		tunable.type === NetworkTablesTypeInfos.kDoubleArray ||
		tunable.type === NetworkTablesTypeInfos.kIntegerArray;
	const isBooleanArray = tunable.type === NetworkTablesTypeInfos.kBooleanArray;

	// For scalar values
	const [editValue, setEditValue] = useState<string>(isArray ? '' : String(tunable.value));
	const [isEditing, setIsEditing] = useState(false);

	// For array values - store as array of strings for editing
	const [arrayValues, setArrayValues] = useState<string[]>(
		isArray ? (tunable.value as (number | boolean | string)[]).map(String) : []
	);
	const [isArrayEditing, setIsArrayEditing] = useState(false);

	// Update local state when tunable value changes from server
	useEffect(() => {
		if (!isEditing && !isArray) {
			setEditValue(String(tunable.value));
		}
	}, [tunable.value, isEditing, isArray]);

	useEffect(() => {
		if (!isArrayEditing && isArray) {
			setArrayValues((tunable.value as (number | boolean | string)[]).map(String));
		}
	}, [tunable.value, isArrayEditing, isArray]);

	// Handle scalar value submit
	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();

			let parsedValue: TunableValueType;

			if (tunable.type === NetworkTablesTypeInfos.kBoolean) {
				parsedValue = editValue.toLowerCase() === 'true';
			} else if (
				tunable.type === NetworkTablesTypeInfos.kDouble ||
				tunable.type === NetworkTablesTypeInfos.kInteger
			) {
				parsedValue =
					tunable.type === NetworkTablesTypeInfos.kInteger
						? parseInt(editValue, 10)
						: parseFloat(editValue);
				if (isNaN(parsedValue)) {
					setEditValue(String(tunable.value));
					setIsEditing(false);
					return;
				}
			} else {
				parsedValue = editValue;
			}

			onUpdateValue(tunable.key, parsedValue);
			setIsEditing(false);
		},
		[editValue, tunable, onUpdateValue]
	);

	// Handle array value submit
	const handleArraySubmit = useCallback(() => {
		let parsedArray: TunableValueType;

		if (isNumberArray) {
			const numbers = arrayValues.map((s) =>
				tunable.type === NetworkTablesTypeInfos.kIntegerArray ? parseInt(s, 10) : parseFloat(s)
			);
			if (numbers.some(isNaN)) {
				setArrayValues((tunable.value as number[]).map(String));
				setIsArrayEditing(false);
				return;
			}
			parsedArray = numbers;
		} else if (isBooleanArray) {
			parsedArray = arrayValues.map((s) => s.toLowerCase() === 'true');
		} else {
			// String array
			parsedArray = arrayValues;
		}

		onUpdateValue(tunable.key, parsedArray);
		setIsArrayEditing(false);
	}, [arrayValues, tunable, onUpdateValue, isNumberArray, isBooleanArray]);

	// Handle individual array cell change
	const handleArrayCellChange = useCallback((index: number, value: string) => {
		setArrayValues((prev) => {
			const next = [...prev];
			next[index] = value;
			return next;
		});
		setIsArrayEditing(true);
	}, []);

	// Handle array cell blur - revert if invalid for number types
	const handleArrayCellBlur = useCallback(
		(index: number) => {
			if (isNumberArray) {
				const currentValue = arrayValues[index] ?? '';
				const parsed =
					tunable.type === NetworkTablesTypeInfos.kIntegerArray
						? parseInt(currentValue, 10)
						: parseFloat(currentValue);
				if (isNaN(parsed)) {
					setArrayValues((prev) => {
						const next = [...prev];
						next[index] = String((tunable.value as number[])[index]);
						return next;
					});
				}
			}
		},
		[arrayValues, tunable, isNumberArray]
	);

	// Add a new element to the array
	const handleArrayAdd = useCallback(() => {
		setArrayValues((prev) => {
			// Default value based on type
			let defaultValue = '0';
			if (isBooleanArray) {
				defaultValue = 'false';
			} else if (!isNumberArray) {
				defaultValue = '';
			}
			return [...prev, defaultValue];
		});
		setIsArrayEditing(true);
	}, [isNumberArray, isBooleanArray]);

	// Remove an element from the array
	const handleArrayRemove = useCallback((index: number) => {
		setArrayValues((prev) => prev.filter((_, i) => i !== index));
		setIsArrayEditing(true);
	}, []);

	// Cancel array editing
	const handleArrayCancel = useCallback(() => {
		setArrayValues((tunable.value as (number | boolean | string)[]).map(String));
		setIsArrayEditing(false);
	}, [tunable.value]);

	const handleBlur = useCallback(() => {
		if (editValue !== String(tunable.value)) {
			setEditValue(String(tunable.value));
		}
		setIsEditing(false);
	}, [editValue, tunable.value]);

	// Get the display name (everything after the group prefix)
	const displayName = tunable.key.includes('/') ? tunable.key.split('/').slice(1).join('/') : tunable.key;

	// Determine the type badge
	const getTypeBadge = () => {
		if (tunable.type === NetworkTablesTypeInfos.kBoolean) return 'bool';
		if (tunable.type === NetworkTablesTypeInfos.kInteger) return 'int';
		if (tunable.type === NetworkTablesTypeInfos.kDouble) return 'double';
		if (tunable.type === NetworkTablesTypeInfos.kString) return 'string';
		if (tunable.type === NetworkTablesTypeInfos.kBooleanArray) return 'bool[]';
		if (tunable.type === NetworkTablesTypeInfos.kIntegerArray) return 'int[]';
		if (tunable.type === NetworkTablesTypeInfos.kDoubleArray) return 'double[]';
		if (tunable.type === NetworkTablesTypeInfos.kStringArray) return 'string[]';
		return 'unknown';
	};

	// Render boolean as toggle
	if (tunable.type === NetworkTablesTypeInfos.kBoolean) {
		return (
			<div className="flex items-center justify-between px-4 py-3">
				<div className="flex items-center gap-3">
					<span className="font-mono text-sm text-[var(--sl-color-white)]">{displayName}</span>
					<span className="rounded bg-[var(--sl-color-accent-low)] px-2 py-0.5 text-xs font-medium text-[var(--sl-color-accent-high)]">
						{getTypeBadge()}
					</span>
				</div>
				<button
					type="button"
					onClick={() => onUpdateValue(tunable.key, !tunable.value)}
					className={`relative h-6 w-11 rounded-full transition-colors ${
						tunable.value ? 'bg-[var(--sl-color-accent)]' : 'bg-[var(--sl-color-gray-4)]'
					}`}
					role="switch"
					aria-checked={Boolean(tunable.value)}
				>
					<span
						className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
							tunable.value ? 'translate-x-5' : 'translate-x-0'
						}`}
					/>
				</button>
			</div>
		);
	}

	// Render array as editable table
	if (isArray) {
		return (
			<div className="px-4 py-3">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="font-mono text-sm text-[var(--sl-color-white)]">{displayName}</span>
						<span className="rounded bg-[var(--sl-color-accent-low)] px-2 py-0.5 text-xs font-medium text-[var(--sl-color-accent-high)]">
							{getTypeBadge()}
						</span>
						<span className="text-xs text-[var(--sl-color-gray-3)]">({arrayValues.length} items)</span>
					</div>
					{isArrayEditing && (
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleArrayCancel}
								className="rounded border border-[var(--sl-color-gray-5)] px-3 py-1 text-sm text-[var(--sl-color-gray-2)] transition-colors hover:bg-[var(--sl-color-gray-6)]"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleArraySubmit}
								className="rounded bg-[var(--sl-color-accent)] px-3 py-1 text-sm font-medium text-white transition-colors hover:brightness-110"
							>
								Save
							</button>
						</div>
					)}
				</div>
				<div className="overflow-hidden rounded border border-[var(--sl-color-gray-5)]">
					<table className="w-full">
						<thead>
							<tr className="border-b border-[var(--sl-color-gray-5)] bg-[var(--sl-color-gray-6)]">
								<th className="px-3 py-2 text-left text-xs font-medium text-[var(--sl-color-gray-2)]">
									Index
								</th>
								<th className="px-3 py-2 text-left text-xs font-medium text-[var(--sl-color-gray-2)]">
									Value
								</th>
								<th className="w-10 px-3 py-2" />
							</tr>
						</thead>
						<tbody>
							{arrayValues.map((value, index) => (
								<tr
									key={index}
									className="border-b border-[var(--sl-color-gray-6)] last:border-b-0"
								>
									<td className="px-3 py-2 font-mono text-sm text-[var(--sl-color-gray-3)]">
										{index}
									</td>
									<td className="px-3 py-2">
										{isBooleanArray ? (
											<button
												type="button"
												onClick={() =>
													handleArrayCellChange(
														index,
														value.toLowerCase() === 'true' ? 'false' : 'true'
													)
												}
												className={`relative h-5 w-9 rounded-full transition-colors ${
													value.toLowerCase() === 'true'
														? 'bg-[var(--sl-color-accent)]'
														: 'bg-[var(--sl-color-gray-4)]'
												}`}
												role="switch"
												aria-checked={value.toLowerCase() === 'true'}
											>
												<span
													className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
														value.toLowerCase() === 'true'
															? 'translate-x-4'
															: 'translate-x-0'
													}`}
												/>
											</button>
										) : (
											<input
												type={isNumberArray ? 'number' : 'text'}
												step={
													tunable.type === NetworkTablesTypeInfos.kDoubleArray
														? 'any'
														: '1'
												}
												value={value}
												onChange={(e) => handleArrayCellChange(index, e.target.value)}
												onBlur={() => handleArrayCellBlur(index)}
												className="w-full rounded border border-[var(--sl-color-gray-5)] bg-[var(--sl-color-black)] px-2 py-1 font-mono text-sm text-[var(--sl-color-white)] focus:border-[var(--sl-color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--sl-color-accent)]"
											/>
										)}
									</td>
									<td className="px-2 py-2">
										<button
											type="button"
											onClick={() => handleArrayRemove(index)}
											className="rounded p-1 text-[var(--sl-color-gray-3)] transition-colors hover:bg-[var(--sl-color-gray-5)] hover:text-[var(--sl-color-text-danger,#ef4444)]"
											title="Remove item"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<line x1="18" y1="6" x2="6" y2="18" />
												<line x1="6" y1="6" x2="18" y2="18" />
											</svg>
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<button
					type="button"
					onClick={handleArrayAdd}
					className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-[var(--sl-color-gray-5)] py-2 text-sm text-[var(--sl-color-gray-3)] transition-colors hover:border-[var(--sl-color-accent)] hover:text-[var(--sl-color-accent)]"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					Add item
				</button>
			</div>
		);
	}

	// Determine if this is a scalar number type
	const isScalarNumber =
		tunable.type === NetworkTablesTypeInfos.kDouble || tunable.type === NetworkTablesTypeInfos.kInteger;

	// Render number/string as input
	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3">
			<div className="flex items-center gap-3">
				<span className="font-mono text-sm text-[var(--sl-color-white)]">{displayName}</span>
				<span className="rounded bg-[var(--sl-color-accent-low)] px-2 py-0.5 text-xs font-medium text-[var(--sl-color-accent-high)]">
					{getTypeBadge()}
				</span>
			</div>
			<form onSubmit={handleSubmit} className="flex items-center gap-2">
				<input
					type={isScalarNumber ? 'number' : 'text'}
					step={tunable.type === NetworkTablesTypeInfos.kDouble ? 'any' : '1'}
					value={editValue}
					onChange={(e) => {
						setEditValue(e.target.value);
						setIsEditing(true);
					}}
					onBlur={handleBlur}
					className="w-32 rounded border border-[var(--sl-color-gray-5)] bg-[var(--sl-color-black)] px-3 py-1.5 text-right font-mono text-sm text-[var(--sl-color-white)] focus:border-[var(--sl-color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--sl-color-accent)]"
				/>
				{isEditing && (
					<button
						type="submit"
						className="rounded bg-[var(--sl-color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:brightness-110"
					>
						Set
					</button>
				)}
			</form>
		</div>
	);
}
