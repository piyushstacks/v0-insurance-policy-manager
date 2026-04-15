require('dotenv').config({ path: '.env.local' });

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    '/node_modules/(?!p-limit|yocto-queue)/',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
};
