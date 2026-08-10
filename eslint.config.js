const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['.expo/**', '.expo-export-check/**', 'dist/**', 'node_modules/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'unicode-bom': 'off',
    },
  },
]);
