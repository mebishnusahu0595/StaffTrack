/**
 * Bug Condition Exploration Tests for Leave Request Screen
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 * 
 * CRITICAL: These tests MUST FAIL on unfixed code - failures confirm the bugs exist
 * DO NOT attempt to fix the tests or the code when they fail
 * 
 * These tests encode the expected behavior and will validate the fixes when they pass
 * after implementation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { LeaveRequestScreen } from '../LeaveRequestScreen';
import * as api from '../../api';

// Mock the API module
jest.mock('../../api', () => ({
  fetchMyLeaves: jest.fn(),
  submitLeaveRequest: jest.fn(),
}));

// Mock the AppIcon component
jest.mock('../../components/AppIcon', () => ({
  appIconSource: jest.fn(() => 'plus'),
}));

// Helper to create a QueryClient for tests
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Helper to render component with providers
function renderWithProviders(component: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('Leave Request Bug Condition Exploration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: return empty leaves array
    (api.fetchMyLeaves as jest.Mock).mockResolvedValue([]);
  });

  /**
   * Bug 1: From Date Button Display Test
   * 
   * Tests that "From" button displays formatted date "From: DD/MM/YYYY" when startDate is set
   * 
   * Expected on UNFIXED code: Button shows "Fro..." instead of formatted date
   * Expected on FIXED code: Button shows "From: DD/MM/YYYY"
   */
  describe('Bug 1: From Date Button Display', () => {
    it('should display formatted date in From button when dialog opens with default date', async () => {
      renderWithProviders(<LeaveRequestScreen />);

      // Open the dialog by clicking the FAB
      const fabButton = screen.getByText('Apply Leave');
      fireEvent.press(fabButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Apply for Leave')).toBeTruthy();
      });

      // Get today's date in the expected format
      const today = new Date();
      const expectedText = `From: ${dayjs(today).format('DD/MM/YYYY')}`;

      // Find the From button - it should contain the formatted date
      const fromButton = screen.getByText(new RegExp('From:', 'i'));
      
      // Assert: Button text should contain "From: " followed by today's date
      // On UNFIXED code: This will FAIL because button shows "Fro..." (truncated)
      // On FIXED code: This will PASS because button shows full formatted date
      expect(fromButton.props.children).toContain('From:');
      expect(fromButton.props.children).toContain(dayjs(today).format('DD/MM/YYYY'));
    });

    it('should display formatted date "From: 15/02/2025" when specific date is selected', async () => {
      renderWithProviders(<LeaveRequestScreen />);

      // Open the dialog
      const fabButton = screen.getByText('Apply Leave');
      fireEvent.press(fabButton);

      await waitFor(() => {
        expect(screen.getByText('Apply for Leave')).toBeTruthy();
      });

      // Find and click the From button to open date picker
      const fromButton = screen.getByText(new RegExp('From:', 'i'));
      fireEvent.press(fromButton);

      // Wait for DateTimePicker to appear
      await waitFor(() => {
        const picker = screen.getByTestId('date-time-picker');
        expect(picker).toBeTruthy();
      });

      // Simulate date selection - Feb 15, 2025
      const picker = screen.getByTestId('date-time-picker');
      const selectedDate = new Date(2025, 1, 15); // Month is 0-indexed
      fireEvent(picker, 'onChange', { type: 'set' }, selectedDate);

      // Wait for picker to close and state to update
      await waitFor(() => {
        const updatedFromButton = screen.getByText(new RegExp('From:', 'i'));
        expect(updatedFromButton).toBeTruthy();
      });

      // Assert: Button should show "From: 15/02/2025"
      // On UNFIXED code: This will FAIL - button shows "Fro..." instead
      // On FIXED code: This will PASS - button shows full date
      const updatedFromButton = screen.getByText(new RegExp('From:', 'i'));
      expect(updatedFromButton.props.children).toContain('From:');
      expect(updatedFromButton.props.children).toContain('15/02/2025');
    });
  });

  /**
   * Bug 2: Today Quick Select Test
   * 
   * Tests that "Today" button exists and sets both dates to today
   * 
   * Expected on UNFIXED code: "Today" button does NOT exist
   * Expected on FIXED code: "Today" button exists and works
   */
  describe('Bug 2: Today Quick Select Button', () => {
    it('should have a "Today" button in the leave dialog', async () => {
      renderWithProviders(<LeaveRequestScreen />);

      // Open the dialog
      const fabButton = screen.getByText('Apply Leave');
      fireEvent.press(fabButton);

      await waitFor(() => {
        expect(screen.getByText('Apply for Leave')).toBeTruthy();
      });

      // Search for "Today" button
      // On UNFIXED code: This will FAIL - button does not exist
      // On FIXED code: This will PASS - button exists
      const todayButton = screen.queryByText('Today');
      expect(todayButton).toBeTruthy();
    });

    it('should set both startDate and endDate to today when "Today" button is clicked', async () => {
      renderWithProviders(<LeaveRequestScreen />);

      // Open the dialog
      const fabButton = screen.getByText('Apply Leave');
      fireEvent.press(fabButton);

      await waitFor(() => {
        expect(screen.getByText('Apply for Leave')).toBeTruthy();
      });

      // Get today's formatted date
      const today = new Date();
      const todayFormatted = dayjs(today).format('DD/MM/YYYY');

      // Find and click "Today" button
      // On UNFIXED code: This will FAIL - button doesn't exist
      const todayButton = screen.getByText('Today');
      fireEvent.press(todayButton);

      // Wait for state update
      await waitFor(() => {
        const fromButton = screen.getByText(new RegExp('From:', 'i'));
        expect(fromButton).toBeTruthy();
      });

      // Assert: Both From and To buttons should show today's date
      // On UNFIXED code: Cannot test this as button doesn't exist
      // On FIXED code: Both buttons show today's date
      const fromButton = screen.getByText(new RegExp('From:', 'i'));
      const toButton = screen.getByText(new RegExp('To:', 'i'));

      expect(fromButton.props.children).toContain(todayFormatted);
      expect(toButton.props.children).toContain(todayFormatted);
    });
  });

  /**
   * Bug 3: Rejected Status Display Test
   * 
   * Tests that rejected leaves display "REJECTED" status with red background
   * 
   * Expected on UNFIXED code: Shows "PENDING" with yellow background
   * Expected on FIXED code: Shows "REJECTED" with red background
   */
  describe('Bug 3: Rejected Status Display', () => {
    it('should display "REJECTED" status badge with red background for rejected leaves', async () => {
      // Mock API to return a leave with REJECTED status
      const rejectedLeave = {
        id: '1',
        userId: 'user123',
        startDate: '2025-01-20',
        endDate: '2025-01-22',
        reason: 'Family emergency',
        status: 'REJECTED' as const,
        createdAt: '2025-01-15T10:00:00Z',
      };

      (api.fetchMyLeaves as jest.Mock).mockResolvedValue([rejectedLeave]);

      renderWithProviders(<LeaveRequestScreen />);

      // Wait for leaves to load
      await waitFor(() => {
        expect(screen.getByText('Family emergency')).toBeTruthy();
      });

      // Find the status badge
      const statusBadge = screen.getByText('REJECTED', { exact: false });

      // Assert: Badge should display "REJECTED" text
      // On UNFIXED code: This will FAIL - badge shows "PENDING"
      // On FIXED code: This will PASS - badge shows "REJECTED"
      expect(statusBadge.props.children).toBe('REJECTED');

      // Assert: Badge background should be red (#FED7D7)
      // Find the parent View with the background color style
      const badgeContainer = statusBadge.parent;
      const backgroundColor = badgeContainer?.props.style.find(
        (style: any) => style.backgroundColor
      )?.backgroundColor;

      // On UNFIXED code: This will FAIL - background is yellow (#FEEBC8)
      // On FIXED code: This will PASS - background is red (#FED7D7)
      expect(backgroundColor).toBe('#FED7D7');
    });

    it('should display "REJECTED" for multiple rejected leaves in the list', async () => {
      // Mock API to return multiple rejected leaves
      const rejectedLeaves = [
        {
          id: '1',
          userId: 'user123',
          startDate: '2025-01-20',
          endDate: '2025-01-22',
          reason: 'First rejected leave',
          status: 'REJECTED' as const,
          createdAt: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          userId: 'user123',
          startDate: '2025-02-10',
          endDate: '2025-02-12',
          reason: 'Second rejected leave',
          status: 'REJECTED' as const,
          createdAt: '2025-02-05T10:00:00Z',
        },
        {
          id: '3',
          userId: 'user123',
          startDate: '2025-03-01',
          endDate: '2025-03-03',
          reason: 'Third rejected leave',
          status: 'REJECTED' as const,
          createdAt: '2025-02-25T10:00:00Z',
        },
      ];

      (api.fetchMyLeaves as jest.Mock).mockResolvedValue(rejectedLeaves);

      renderWithProviders(<LeaveRequestScreen />);

      // Wait for leaves to load
      await waitFor(() => {
        expect(screen.getByText('First rejected leave')).toBeTruthy();
      });

      // Find all status badges with "REJECTED" text
      const rejectedBadges = screen.getAllByText('REJECTED', { exact: false });

      // On UNFIXED code: This will FAIL - badges show "PENDING" not "REJECTED"
      // On FIXED code: This will PASS - all 3 badges show "REJECTED"
      expect(rejectedBadges).toHaveLength(3);

      // Verify each badge shows "REJECTED"
      rejectedBadges.forEach((badge) => {
        expect(badge.props.children).toBe('REJECTED');
      });
    });
  });
});
