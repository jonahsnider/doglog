import { useSelector } from '@tanstack/react-store';
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';
import { settingsStore } from '@/settings';

/** Tells this device's user apart from others, and groups their sessions in several tabs and windows */
export const userIdStore = createPersistedAtom('user-id', z.string().min(1), crypto.randomUUID());

/** This tab or window */
export const sessionId = crypto.randomUUID();

const breeds = [
	'Akita',
	'Basset Hound',
	'Beagle',
	'Bernese',
	'Border Collie',
	'Boxer',
	'Bulldog',
	'Corgi',
	'Dachshund',
	'Dalmatian',
	'Golden Retriever',
	'Greyhound',
	'Husky',
	'Labrador',
	'Malamute',
	'Newfoundland',
	'Poodle',
	'Pug',
	'Samoyed',
	'Schnauzer',
	'Shiba Inu',
	'Terrier',
	'Whippet',
] as const;

/** Shown to others until the user sets a name in Settings */
const anonymousNameStore = createPersistedAtom(
	'anonymous-name',
	z.string().min(1),
	`Anonymous ${breeds[Math.floor(Math.random() * breeds.length)] ?? 'Dog'}`,
);

function displayName(name: string, anonymousName: string): string {
	return name.trim() === '' ? anonymousName : name.trim();
}

/** The name others see in shared dashboards */
export function getDisplayName(): string {
	return displayName(settingsStore.get().name, anonymousNameStore.get());
}

export function useAnonymousName(): string {
	return useSelector(anonymousNameStore);
}
