import { FlatCompat } from '@eslint/eslintrc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const physicalDirection =
  '\\b(?:pl|pr|ml|mr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r|inset-l|inset-r|scroll-pl|scroll-pr|scroll-ml|scroll-mr)-';

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'machinery-web-plan/**',
      'src/lib/api/generated/**',
      'src/i18n/messages/**',
    ],
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: 'Raw hex colours are only allowed in src/styles/tokens.css.',
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/components/!(ui)/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    ignores: ['src/components/ui/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: 'Raw hex colours are only allowed in src/styles/tokens.css.',
        },
        {
          selector: `Literal[value=/${physicalDirection}/]`,
          message:
            'Use logical CSS (ps-/pe-/ms-/me-/start-/end-/text-start). Physical direction is banned outside components/ui/.',
        },
        {
          selector: `TemplateElement[value.raw=/${physicalDirection}/]`,
          message:
            'Use logical CSS (ps-/pe-/ms-/me-/start-/end-/text-start). Physical direction is banned outside components/ui/.',
        },
      ],
    },
  },
];

export default eslintConfig;
