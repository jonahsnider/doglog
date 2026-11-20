import { customAlphabet } from 'nanoid';

/** ~95 bits of randomness, without punctuation that can break dashboard links in chat. */
export const createId = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 16);
