// Setup file for Jest
import '@testing-library/react-native/extend-expect';

// Mock expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {}
  }
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

// Mock async storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ value, onChange }) => {
      return React.createElement('DateTimePicker', {
        testID: 'date-time-picker',
        value,
        onChange
      });
    }
  };
});

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
