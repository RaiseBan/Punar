const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
    {
        ignores: ['node_modules/**', 'dist/**', 'out/**', '*.log', 'electron-data/**'],
    },
    {
        files: ['src/**/*.{ts,js}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                project: './tsconfig.json',
            },
            globals: {
                node: true,
                es2022: true,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...prettierConfig.rules,
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': 'warn', // было 'error'
            '@typescript-eslint/ban-ts-comment': 'warn', // добавь эту строку
            '@typescript-eslint/no-require-imports': 'warn', // добавь эту строку
            '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn', // добавь эту строку
        },
    },
];