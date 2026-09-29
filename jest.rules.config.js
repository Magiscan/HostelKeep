// Firestore rules tests: plain Node, talking to the local emulator.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/rules/**/*.test.js'],
  testTimeout: 20000,
};
