module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm/.*?/node_modules/|)(?:(jest-)?react-native(-.*)?|@react-native(-.*)?|expo(-.*)?|@expo(-.*)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation(-.*)?|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|dayjs))'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testEnvironment: 'node'
};
