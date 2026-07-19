import js from '@eslint/js';
import nextConfig from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.next-e2e/**',
      '**/coverage/**',
      '**/src/generated/**',
      '**/database.generated.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  ...nextConfig.map((config) => ({
    ...config,
    files: ['apps/web/**/*.{js,jsx,ts,tsx,mjs}'],
    settings: {
      ...config.settings,
      react: { version: '19.2' },
      next: { rootDir: 'apps/web/' },
    },
  })),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.config.{js,mjs,ts}', 'apps/api/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      // Nest uses runtime class imports for decorator metadata and dependency injection.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
);
