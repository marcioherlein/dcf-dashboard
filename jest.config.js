/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: false } }],
  },
  testMatch: [
    '**/lib/valuation/__tests__/guards.test.ts',
    '**/lib/valuation/__tests__/dcf.test.ts',
  ],
}
