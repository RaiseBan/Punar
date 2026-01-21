module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'prettier', // Must be last
  ],
  rules: {
    // TypeScript specific
    '@typescript-eslint/no-explicit-any': 'warn', // ИСПРАВЛЕНО: было 'no-explicit-'
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // General
    'prefer-const': 'error',
    'no-var': 'error',
    'no-restricted-globals': ['error', 'confirm', 'prompt', 'alert'], // ДОБАВЛЕНО
  },
};