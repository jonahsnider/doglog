/** @type {import("prettier").Config} */
const config = {
	tabWidth: 2,
	useTabs: true,
	singleQuote: true,
	plugins: ['prettier-plugin-astro', 'prettier-plugin-packagejson', 'prettier-plugin-java'],
	printWidth: 120,
	overrides: [
		{
			files: '*.astro',
			options: {
				parser: 'astro',
			},
		},
	],
};

export default config;
