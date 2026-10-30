import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules'] },
  js.configs.recommended,
  { languageOptions: { globals: globals.node, ecmaVersion: 2024, sourceType: 'module' },
    rules: { 'no-control-regex': 'off', 'no-irregular-whitespace': ['error', { skipRegExps: true, skipStrings: true, skipTemplates: true }], 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
];
