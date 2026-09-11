import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  // Scoped to e2e/ only — applied workspace-wide it also matches src/**/*.spec.ts (vitest
  // specs, not Playwright ones), flagging their `describe`/`it`/`expect` as if they were
  // misused Playwright APIs.
  { ...playwright.configs['flat/recommended'], files: ['e2e/**/*.ts'] },
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
];
