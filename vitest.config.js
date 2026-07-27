'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['lib/importer/**/*.test.js', 'lib/auth/**/*.test.js', 'lib/stock/**/*.test.js', 'lib/ops/**/*.test.js', 'lib/recipes/**/*.test.js', '__tests__/**/*.test.js'],
    environment: 'node',
  },
});
