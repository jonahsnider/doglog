import { Fraction } from 'fraction.js';
import { convertUnit, parseUnit, type Unit } from '@/data/units';

// A number, with the unit right after it if there's one, ex. `5 ft` or `6 ft/s` (a `/` with no letter after it divides)
const tokenPattern =
	/\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)(?:\s*([a-zµ°][a-zµ°²]*(?:\^2)?(?:\/[a-zµ°][a-zµ°²]*(?:\^2)?)*))?|([-+*/()]))/iuy;

/** A number's exact value, ex. `0.1` is 1/10 instead of the double nearest to it */
function exactNumber(text: string): Fraction {
	const [mantissa = '', exponent = '0'] = text.toLowerCase().split('e');
	// Fractions don't parse exponents or a trailing point, ex. `1.e3`
	return new Fraction(mantissa.endsWith('.') ? mantissa.slice(0, -1) : mantissa).mul(
		new Fraction(10).pow(Number(exponent)),
	);
}

/** A number typed with a unit, converted to `to`. `undefined` if they don't measure the same thing. */
function convertedNumber(number: string, unitText: string, to: Unit | undefined): Fraction | undefined {
	const from = parseUnit(unitText);
	if (from === undefined || to === undefined || from.measure !== to.measure) {
		return undefined;
	}
	// Conversions aren't exact anyway, ex. degrees to radians, and the shortest decimal of the double keeps its value
	return exactNumber(String(convertUnit(Number(number), from, to)));
}

/**
 * Evaluate arithmetic typed in a number field, ex. `10 + 1` or `-(2 * 3) / 4`: numbers, `+ - * /`, and parentheses,
 * with the usual precedence. It's exact until the result, so `0.1 + 0.2` is `0.3` and `2 / 3` is the double nearest to
 * 2/3. Numbers can have a unit that's converted to `unit`, ex. `5 ft + 3 in` for a length in meters.
 * `undefined` if it isn't a valid expression, a unit doesn't convert, or its result isn't finite.
 */
export function evaluateExpression(text: string, unit?: Unit): number | undefined {
	const tokens: string[] = [];
	const numbers: { number: string; unit: string | undefined }[] = [];
	tokenPattern.lastIndex = 0;
	while (tokenPattern.lastIndex < text.trimEnd().length) {
		const match = tokenPattern.exec(text);
		if (!match) {
			return undefined;
		}
		tokens.push(match[3] ?? '');
		if (match[1] !== undefined) {
			numbers.push({ number: match[1], unit: match[2] });
		}
	}
	let index = 0;
	let numberIndex = 0;
	const peek = () => tokens[index];

	// Each level returns `undefined` for invalid input, which every caller passes on
	const atom = (): Fraction | undefined => {
		const token = tokens[index++];
		if (token === '') {
			const { number, unit: unitText } = numbers[numberIndex++]!;
			return unitText === undefined ? exactNumber(number) : convertedNumber(number, unitText, unit);
		}
		if (token === '-' || token === '+') {
			const value = atom();
			return token === '+' ? value : value?.neg();
		}
		if (token !== '(') {
			return undefined;
		}
		const value = sum();
		return tokens[index++] === ')' ? value : undefined;
	};
	const product = (): Fraction | undefined => {
		let value = atom();
		while (value !== undefined && (peek() === '*' || peek() === '/')) {
			const operator = tokens[index++];
			const right = atom();
			value =
				right === undefined || (operator === '/' && right.equals(0))
					? undefined
					: operator === '*'
						? value.mul(right)
						: value.div(right);
		}
		return value;
	};
	const sum = (): Fraction | undefined => {
		let value = product();
		while (value !== undefined && (peek() === '+' || peek() === '-')) {
			const operator = tokens[index++];
			const right = product();
			value = right === undefined ? undefined : operator === '+' ? value.add(right) : value.sub(right);
		}
		return value;
	};

	const value = sum();
	if (index !== tokens.length || value === undefined) {
		return undefined;
	}
	// A number alone, or negated, keeps every digit, a huge fraction converts to the nearest double less reliably
	const [only] = numbers;
	const result =
		numbers.length === 1 && only?.unit === undefined
			? Math.sign(value.compare(0)) * Number(only?.number)
			: value.valueOf();
	return Number.isFinite(result) ? result : undefined;
}

const fractionPattern = /^-?\d+\/\d+$/u;

/** `text` without spaces when it's a fraction, ex. `2/3`, which is shown as it's typed instead of as its value */
export function typedFraction(text: string): string | undefined {
	const compact = text.replaceAll(/\s/gu, '');
	return fractionPattern.test(compact) ? compact : undefined;
}

/** A number rounded to read at a glance: to 2 decimal places, or 2 significant digits when it's smaller, ex. `0.67` for 2/3, `0.00012` for 0.000123 */
export function roundNumber(value: number): string {
	if (value === 0 || !Number.isFinite(value)) {
		return String(value);
	}
	const decimals = Math.max(2, 1 - Math.floor(Math.log10(Math.abs(value))));
	return String(Number(value.toFixed(Math.min(decimals, 100))));
}

/** `text` rounded when it's a number, see `roundNumber()` */
export function roundText(text: string): string {
	const value = Number(text);
	return text.trim() === '' || !Number.isFinite(value) ? text : roundNumber(value);
}
