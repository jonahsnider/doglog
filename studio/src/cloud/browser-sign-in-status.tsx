import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useSelector } from '@tanstack/react-store';
import { useState } from 'react';
import { browserSignInStore, cancelBrowserSignIn, enterSignInCode } from '@/cloud/desktop-sign-in';
import { isEnterKey } from '@/lib/keyboard';

/**
 * While the desktop app waits on a sign-in in the browser, lets the user cancel it, or paste the code the browser
 * shows when its link doesn't open the app
 */
export function BrowserSignInStatus({ message }: { message: string }) {
	const waiting = useSelector(browserSignInStore);
	return waiting ? <Waiting message={message} /> : null;
}

function Waiting({ message }: { message: string }) {
	const [code, setCode] = useState('');
	const [checking, setChecking] = useState(false);
	const [invalid, setInvalid] = useState(false);

	async function submit(value: string) {
		if (value.trim() === '') {
			return;
		}
		setChecking(true);
		const accepted = await enterSignInCode(value);
		setChecking(false);
		setInvalid(!accepted);
	}

	return (
		<VStack gap={2}>
			<HStack vAlign="center" wrap="wrap" gap={3}>
				<Text role="status" color="secondary">
					{message}
				</Text>
				<Button label="Cancel" size="sm" onClick={cancelBrowserSignIn} />
			</HStack>
			<TextInput
				label="Sign-in code"
				isLabelHidden
				size="sm"
				placeholder="Paste the code from your browser"
				hasSpellCheck={false}
				autoComplete="off"
				value={code}
				isLoading={checking}
				status={invalid ? { type: 'error', message: 'That isn’t the code for this sign-in.' } : undefined}
				onChange={(next) => {
					setCode(next);
					setInvalid(false);
				}}
				onPaste={(event) => {
					event.preventDefault();
					const pasted = event.clipboardData.getData('text');
					setCode(pasted);
					void submit(pasted);
				}}
				onKeyDown={(event) => {
					if (isEnterKey(event)) {
						void submit(code);
					}
				}}
			/>
		</VStack>
	);
}
