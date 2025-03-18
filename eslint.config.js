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
      curly: ['error', 'multi-line'],
      'one-var': ['error', 'never'],
      quotes: ['error', 'single', { avoidEscape: true }],
    },
  },

  {
    rules: {
      'capitalized-comments': 'off',
      'init-declarations': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'no-magic-numbers': 'off',
      'no-ternary': 'off',
      'no-undefined': 'off',
      'sort-imports': 'off',
    },
  },

  {
    rules: {
      'unicorn/no-anonymous-default-export': 'off',
      'unicorn/no-keyword-prefix': 'off',
    },
  },

  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },
]);
