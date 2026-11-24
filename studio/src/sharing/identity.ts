import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import * as z from 'zod';
import { cloudAccountStore } from '@/cloud/session';
import { createPersistedAtom } from '@/lib/persisted-store';
import { createId } from '@/lib/random-id';
import { settingsStore } from '@/settings';

/** Tells this device's user apart from others, and groups their sessions in several tabs and windows */
export const userIdStore = createPersistedAtom('user-id', z.string().min(1), createId());

/** This tab or window */
export const sessionId = createId();

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
	'Pitbull',
	'Poodle',
	'Pug',
	'Samoyed',
	'Schnauzer',
	'Shiba Inu',
	'Terrier',
] as const;

/** Shown to others when no sharing name has been set */
const anonymousNameStore = createPersistedAtom(
	'anonymous-name',
	z.string().min(1),
	`Anonymous ${breeds[Math.floor(Math.random() * breeds.length)] ?? 'Dog'}`,
);

export const displayNameStore = createAtom(() => {
	const account = cloudAccountStore.get();
	const name = account === null ? settingsStore.get().name.trim() : account.displayName;
	return name === null || name === '' ? anonymousNameStore.get() : name;
});

export function useAnonymousName(): string {
	return useSelector(anonymousNameStore);
}
