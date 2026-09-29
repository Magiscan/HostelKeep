// Runs before every unit test file (see setupFiles in jest.config.js).
//
// Native modules don't exist under Jest, so anything that imports them at the
// top of a file (i18n.js imports AsyncStorage) needs an in-memory stand-in.

// Official in-memory mock shipped with the package.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Fixed device language, so translation tests behave the same on every machine.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));