module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'prettier', // Must be last
  ],
  rules: {
    // TypeScript specific
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // General
    'prefer-const': 'error',
    'no-var': 'error',
  },
};