// AsyncStorage's native module doesn't exist under Jest, so it throws on
// import — which takes down any test whose module graph reaches it (e.g.
// src/lib/cache.ts -> use-cached-resource.ts -> the concert/profile hooks),
// even when the test itself never touches storage. This is the mock the
// library ships for exactly this case.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
