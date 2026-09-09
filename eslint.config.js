// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // client/ is a separate Nx workspace with its own eslint.config.mjs and tsconfig graph
    // (client/eslint.config.mjs); this root config's `projectService` can't resolve files
    // outside its own tsconfig, so it must not scan them at all.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**', 'client/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.js', '*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is proibido no código de produção. Use o RNG semeado em src/core/rng.ts.',
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
);
