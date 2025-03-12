import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import unicorn from 'eslint-plugin-unicorn';
import jest from 'eslint-plugin-jest';

export default defineConfig([
  js.configs.all,

  stylistic.configs.customize({
    quoteProps: 'as-needed',
    semi: true,
  }),

  unicorn.configs.all,

  jest.configs['flat/all'],

  {
    rules: {
      'capitalized-comments': 'off',
      curly: ['error', 'multi-line'],
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'no-magic-numbers': 'off',
      'no-ternary': 'off',
      'one-var': ['error', 'never'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'sort-imports': 'off',
    },
  },
]);
