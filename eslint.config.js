import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

const browserGlobals = {
  alert: 'readonly',
  Blob: 'readonly',
  cancelAnimationFrame: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  confirm: 'readonly',
  console: 'readonly',
  devicePixelRatio: 'readonly',
  document: 'readonly',
  FileReader: 'readonly',
  globalThis: 'readonly',
  ImageData: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  Path2D: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  ResizeObserver: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
  URL: 'readonly',
  window: 'readonly',
};

const nodeGlobals = {
  Buffer: 'readonly',
  process: 'readonly',
};

export default [
  {
    ignores: [
      'artifacts/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react/jsx-uses-vars': 'error',
    },
    settings: {
      react: { version: '18.3' },
    },
  },
  {
    files: ['src/core/dxfTemplateAC1015.js'],
    rules: {
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['src/store/useModelStore.js'],
    rules: {
      'no-dupe-keys': 'off',
    },
  },
  {
    files: ['tests/**/*.mjs'],
    rules: {
      'no-control-regex': 'off',
      'no-regex-spaces': 'off',
    },
  },
  {
    files: [
      'src/components/Canvas.jsx',
      'src/components/modals/AddDimensionModal.jsx',
      'src/components/modals/AddOpeningModal.jsx',
      'src/components/modals/RoofPlaneModal.jsx',
      'src/components/modals/RoofTrussModal.jsx',
    ],
    rules: {
      // Deuda heredada registrada en governance/LINT_BASELINE.md. No se corrige en SPEC-000.
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
