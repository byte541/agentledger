module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['sdk/**/*.ts', 'cli/**/*.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000
};
