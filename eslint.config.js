import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import noWindowAccess from './eslint-plugin-custom/rules/no-window-access.js';
import noLocalGameState from './eslint-plugin-custom/rules/no-local-game-state.js';
import requireSyncedState from './eslint-plugin-custom/rules/require-synced-state.js';

export default [
  { ignores: ['dist', 'coverage/', 'coverage-report/', '.eslintrc.cjs'] },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        CustomEvent: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        crypto: 'readonly',
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        prompt: 'readonly',
        alert: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        Image: 'readonly',
        URLSearchParams: 'readonly',
        EventSource: 'readonly',
        Event: 'readonly',
        PointerEvent: 'readonly',
        WheelEvent: 'readonly',
        MouseEvent: 'readonly',
        ClipboardEvent: 'readonly',
        KeyboardEvent: 'readonly',
        TouchEvent: 'readonly',
        GamepadEvent: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'server-first': {
        rules: {
          'no-window-access': noWindowAccess,
          'no-local-game-state': noLocalGameState,
          'require-synced-state': requireSyncedState,
        },
      },
    },
    settings: {
      react: { version: '19' },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'react/jsx-uses-vars': 'warn',
      'react/jsx-uses-react': 'warn',
      // Server-first pattern enforcement
      'server-first/no-window-access': 'error',
      'server-first/no-local-game-state': 'error',
      'server-first/require-synced-state': 'warn',
    },
  },
];
