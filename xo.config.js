module.exports = {
	ignores: [
		'./*.config.js',
		'./test/fixtures'
	],
	rules: {
		'capitalized-comments': [
			'error',
			'always',
			{
				line: {
					ignorePattern: '.',
				},
			},
		],
		complexity: 'off',
		'default-case': 'off',
		'max-depth': [
			'error',
			8,
		],
		'max-params': [
			'error',
			12,
		],
		'one-var': [
			'error',
			{
				initialized: 'never',
				uninitialized: 'consecutive',
			},
		],
		'@typescript-eslint/brace-style': [
			'error',
			'stroustrup',
		],
		'@typescript-eslint/keyword-spacing': [
			'error',
			{
				overrides: {
					if: {
						after: false,
					},
					for: {
						after: false,
					},
					while: {
						after: false,
					},
				},
			},
		],
		'@typescript-eslint/object-curly-spacing': [
			'error',
			'always',
		],
		'unicorn/empty-brace-spaces': 'off',
		'unicorn/prefer-module': 'off',
		'unicorn/prefer-node-protocol': 'off',
	},
};
