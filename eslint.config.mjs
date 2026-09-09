// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // A config object whose only key is `ignores` is a *global* ignore. Keeping
  // it separate from the rules block below is what makes that true — when the
  // two were merged, this acted as a per-config filter instead.
  {
    ignores: [
      'node_modules/**',
      'docs/**',
      'karabiner-output.json',
      'backups/**',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Type information is enabled for the two type-aware rules below only.
    // The full `recommendedTypeChecked` set is not used: its
    // `no-floating-promises` fires on every `test()` call from `node:test`,
    // which is the documented way to write these tests.
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Directly enforces the discriminated-union discipline the engine relies
      // on: a new ActionSpec / Condition variant must be handled everywhere it
      // is switched over.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // Type-only imports must say so; `verbatimModuleSyntax` is on.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Ratchet: `any` is a warning, and `npm run lint` fails above the current
      // count (see --max-warnings in package.json). Lower the ceiling as the
      // remaining sites are typed; never raise it.
      '@typescript-eslint/no-explicit-any': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  {
    // Tests deliberately construct malformed inputs to assert the engine
    // rejects them.
    files: ['src/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    // Layering boundary: `src/data/**` is a dependency of `src/engine/**`,
    // never the reverse. This is the rule that was actually broken twice
    // before this config existed — `data/constants/env.ts` imported a type
    // from `engine/resolve-to-action`, and `data/registries/combos.ts`
    // imported `mapSpec` from `engine/resolve-to-action/resolve-map` to
    // build its own registry data — both silent until someone traced the
    // import graph by hand. `src/index.ts` is the one file allowed to see
    // both sides; it is not under `src/data/**`.
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/engine', '**/engine/**'],
              message:
                'src/data/** must not import from src/engine/**. Data is a dependency of the engine, never the reverse — move the compiled/derived logic into src/engine and have it import the data instead.',
            },
          ],
        },
      ],
    },
  },

  {
    // Sub-boundary within data: constants stay context-free scalars with zero
    // dependency on named content tables. Registries (APPS, DEVICES, BUTTONS,
    // COMBOS, ...) may depend on constants — PROFILES already does, for
    // DEFAULT_PROFILE/PREFERRED_PROFILE — but not the other way around.
    files: ['src/data/constants/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/registries', '**/registries/**'],
              message:
                'src/data/constants/** must not import from src/data/registries/**. If a type needs a registry (e.g. it is keyed off a specific registry\'s entries), it belongs in src/data/registries/, not here.',
            },
          ],
        },
      ],
    },
  },
]);
