# Leave Request Fixes Bugfix Design

## Overview

This document formalizes the three bugs in the Leave Request screen and defines the fix approach:

1. **From Date Button Display Bug**: The "From" button shows placeholder text "Fro..." instead of the selected date due to incorrect button content rendering
2. **Missing Today Quick Select**: Users lack a convenient single-click option to set both dates to today
3. **Incorrect Leave Status Display Bug**: Rejected leave requests display as "PENDING" due to incorrect conditional logic in the status badge rendering

The fixes are minimal and targeted: correct the button content for bug 1, add a "Today" button for bug 2, and fix the conditional rendering logic for bug 3. All existing functionality must be preserved.

## Glossary

- **Bug_Condition (C)**: The condition that triggers each bug
- **Property (P)**: The desired behavior when the bug condition is met
- **Preservation**: Existing date picker, submission, and display behavior that must remain unchanged
- **LeaveRequestScreen**: The React Native component in `apps/mobile/src/screens/LeaveRequestScreen.tsx` that manages leave requests
- **startDate / endDate**: React state variables holding Date objects for the leave date range
- **LeaveStatus**: TypeScript type defined as `"PENDING" | "APPROVED" | "REJECTED"` in the API types
- **status badge**: The UI chip component that displays the leave request status with color-coded background

## Bug Details

### Bug 1: From Date Button Not Showing Selected Date

#### Bug Condition

The bug manifests when a user views or interacts with the "From" date button in the leave application dialog. The button should display the selected date but instead shows truncated placeholder text.

**Formal Specification:**
```
FUNCTION isBugCondition1(input)
  INPUT: input of type { startDate: Date, buttonElement: ReactElement }
  OUTPUT: boolean
  
  RETURN buttonElement.label = "From: {formattedDate}"
         AND startDate is a valid Date
         AND buttonRenderedText shows "Fro..." instead of full date
END FUNCTION
```

#### Examples

- User opens dialog with default startDate = today → Button shows "Fro..." instead of "From: 17/01/2025"
- User selects Jan 20, 2025 as start date → Button shows "Fro..." instead of "From: 20/01/2025"
- User selects Feb 1, 2025 as start date → Button shows "Fro..." instead of "From: 01/02/2025"
- Edge case: User selects Dec 31, 2024 → Button should show "From: 31/12/2024" (must work for any valid date)

### Bug 2: Missing Today Quick Select

#### Bug Condition

The bug manifests when a user wants to apply for single-day leave (today only). The UI lacks a quick action button, requiring manual date selection twice.

**Formal Specification:**
```
FUNCTION isBugCondition2(input)
  INPUT: input of type { userIntent: "apply_for_today" }
  OUTPUT: boolean
  
  RETURN userIntent = "apply_for_today"
         AND NOT EXISTS quickSelectButton("Today")
         AND user must manually select same date twice
END FUNCTION
```

#### Examples

- User wants to take today off → Must click "From" button, select today, click "To" button, select today (manual, tedious)
- User wants emergency single-day leave → No quick action available (expected: single "Today" button click)
- Edge case: After clicking "Today" button, both dates should be set to current date regardless of previous selections

### Bug 3: Incorrect Leave Status Display

#### Bug Condition

The bug manifests when the backend API returns a leave request with `status: "REJECTED"`. The UI incorrectly displays "PENDING" in a yellow badge instead of "REJECTED" in a red badge.

**Formal Specification:**
```
FUNCTION isBugCondition3(input)
  INPUT: input of type { leave: LeaveRequest }
  OUTPUT: boolean
  
  RETURN leave.status = "REJECTED"
         AND statusBadge.text = "PENDING"
         AND statusBadge.backgroundColor = "#FEEBC8" (yellow)
         AND (expected statusBadge.text = "REJECTED" AND backgroundColor = "#FED7D7" (red))
END FUNCTION
```

#### Examples

- Backend returns `{ status: "REJECTED", ... }` → UI shows "PENDING" badge in yellow instead of "REJECTED" in red
- User with 3 rejected leaves → All 3 show "PENDING" status instead of "REJECTED"
- User checks leave status → Sees yellow "PENDING" when leave was actually rejected by manager
- Edge case: Leave with status "REJECTED" at any position in the list should display correctly

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Date picker functionality must continue to work for both "From" and "To" dates using `@react-native-community/datetimepicker`
- "To" date button must continue to display correctly as "To: DD/MM/YYYY"
- Leave submission must continue to send dates in YYYY-MM-DD format to backend
- "PENDING" status must continue to display in yellow background (#FEEBC8)
- "APPROVED" status must continue to display in green background (#C6F6D5)
- Leave list rendering (date range, reason, createdAt) must remain unchanged
- Loading and empty states must continue to display correctly
- Form validation (reason required) must continue to work

**Scope:**
All inputs that do NOT involve the three specific bug conditions should be completely unaffected by these fixes. This includes:
- Clicking "To" date button and selecting dates
- Viewing approved and pending leave requests
- Submitting leave requests with valid data
- Viewing leave request metadata (creation date, reason)
- Any other UI interactions in the leave screen

## Hypothesized Root Cause

Based on the bug descriptions and code analysis:

### Bug 1: From Date Button Display

**Root Cause**: The "From" button content is missing the date formatting. Looking at line 92-94 in LeaveRequestScreen.tsx:

```tsx
<Button mode="outlined" onPress={() => setShowPicker("start")} style={styles.dateBtn}>
  From: {dayjs(startDate).format("DD/MM/YYYY")}
</Button>
```

The code appears correct, but if the button shows "Fro..." it suggests:
1. **Text Truncation Issue**: The button's `style={styles.dateBtn}` with `flex: 1` may be causing text overflow/truncation
2. **React Native Paper Button Issue**: The Button component may be truncating the label
3. **Missing Label Prop**: The content should be in a `label` prop or wrapped in `<Text>` component

Most likely: The Button component's text is being truncated due to layout constraints or missing proper text rendering configuration.

### Bug 2: Missing Today Quick Select

**Root Cause**: No "Today" quick action button exists in the UI. This is a missing feature, not a code defect. The implementation needs:
1. A new Button component in the dialog
2. An onClick handler that sets both `startDate` and `endDate` to `new Date()`
3. Placement in the UI (likely near or above the date buttons)

### Bug 3: Incorrect Leave Status Display

**Root Cause**: Looking at lines 72-75 in LeaveRequestScreen.tsx:

```tsx
<View
  style={[
    styles.statusChip,
    { backgroundColor: leave.status === "PENDING" ? "#FEEBC8" : leave.status === "APPROVED" ? "#C6F6D5" : "#FED7D7" }
  ]}
>
  <Text style={styles.statusText}>{leave.status}</Text>
</View>
```

The background color logic correctly handles all three statuses (PENDING, APPROVED, and REJECTED as fallback). However, **line 77 shows `{leave.status}`** which should display the actual status. 

The issue must be:
1. **Backend not returning correct status**: The API might be returning "PENDING" even for rejected leaves (database or API bug)
2. **Data transformation issue**: Something in the data flow is overwriting the status before rendering
3. **Type coercion issue**: The status value might be getting corrupted during data mapping

Most likely: This is a **backend/API data issue** where rejected leaves are stored or returned with status "PENDING". The frontend code correctly renders `leave.status`, so if it shows "PENDING", that's what the API returned.

However, if we assume the backend is correct, the only frontend issue could be: the conditional logic at line 74 is correct for background color, but we need to verify the text at line 77 is actually rendering `leave.status` correctly.

## Correctness Properties

Property 1: Bug Condition - From Date Display

_For any_ state where the "From" button is rendered with a valid startDate, the button SHALL display the formatted date as "From: DD/MM/YYYY" without truncation or placeholder text, matching the format and visibility of the "To" button.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Today Quick Select

_For any_ user interaction where the "Today" button is clicked, the system SHALL immediately set both startDate and endDate state variables to the current date (today), and both date buttons SHALL reflect this change by displaying today's date in "DD/MM/YYYY" format.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition - Rejected Status Display

_For any_ leave request object where leave.status equals "REJECTED", the status badge SHALL display the text "REJECTED" (not "PENDING") with a red background color (#FED7D7).

**Validates: Requirements 2.5, 2.6**

Property 4: Preservation - Non-Buggy Inputs

_For any_ input that does NOT involve the three bug conditions (From button display, Today selection, or Rejected status), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for date selection, form submission, and status display for PENDING and APPROVED states.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/mobile/src/screens/LeaveRequestScreen.tsx`

### Bug 1 Fix: From Date Button Display

**Specific Changes**:
1. **Verify Button Content Rendering**: Ensure the button properly renders the date text without truncation
   - Check if the text needs to be wrapped in a `<Text>` component
   - Verify the `styles.dateBtn` flex styling isn't causing text overflow
   - Consider using `contentStyle` or `labelStyle` props on the Button component

2. **Alternative: Use Consistent Rendering Pattern**: Match the "To" button implementation exactly if they differ

3. **Test Edge Cases**: Verify long date strings (e.g., "From: 31/12/2024") display fully

### Bug 2 Fix: Add Today Quick Select

**Specific Changes**:
1. **Add "Today" Button**: Insert a new Button component in the dialog content (around line 91, before the date buttons)
   ```tsx
   <Button 
     mode="contained" 
     onPress={() => {
       const today = new Date();
       setStartDate(today);
       setEndDate(today);
     }}
     style={{ marginBottom: 12 }}
   >
     Today
   </Button>
   ```

2. **Handler Logic**: Create a function that sets both dates to `new Date()` simultaneously

3. **UI Placement**: Position the button prominently for easy access (above or below the date range buttons)

### Bug 3 Fix: Correct Leave Status Display

**Approach 1: If Backend is Correct**
1. **Verify Data Flow**: Add logging to confirm `leave.status` value at render time
2. **Check for Overrides**: Ensure no data transformation is modifying the status
3. **Verify Type Safety**: Ensure the status value matches the LeaveStatus type exactly

**Approach 2: If Frontend Logic Needs Fix**
1. **Simplify Conditional**: The current ternary is correct but could be more explicit:
   ```tsx
   const getStatusBgColor = (status: LeaveStatus) => {
     switch (status) {
       case "PENDING": return "#FEEBC8";
       case "APPROVED": return "#C6F6D5";
       case "REJECTED": return "#FED7D7";
       default: return "#FED7D7"; // Fallback for rejected
     }
   };
   ```

2. **Verify Text Rendering**: Ensure line 77 `{leave.status}` is not being overridden or transformed

**Most Likely Fix**: This appears to be a backend data issue. The frontend code correctly renders the status. The fix may require:
- Backend investigation to ensure rejected leaves are stored with status "REJECTED"
- Data migration if existing records have incorrect status values
- Frontend defensive coding: force display of "REJECTED" only if confirmed by backend team

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach:
1. **Exploratory Bug Condition Checking**: Surface counterexamples on unfixed code
2. **Fix Checking**: Verify fixes work for all buggy inputs
3. **Preservation Checking**: Verify non-buggy behavior remains unchanged

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fixes. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render the LeaveRequestScreen component with various states and assert the expected correct behavior. Run these tests on the UNFIXED code to observe failures and understand the root causes.

**Test Cases**:

1. **Bug 1 - From Date Button Display Test**:
   - Render LeaveRequestScreen, open dialog with default date (will fail on unfixed code)
   - Assert "From" button displays "From: {today's date in DD/MM/YYYY}" format
   - Select a specific date (e.g., Feb 15, 2025) and assert button updates to "From: 15/02/2025"
   - Test with various dates to ensure no truncation occurs

2. **Bug 2 - Today Button Existence Test**:
   - Render LeaveRequestScreen, open dialog (will fail on unfixed code)
   - Search for a button with text "Today" or accessible label "Today"
   - Assert button does NOT exist in current UI (confirms missing feature)

3. **Bug 3 - Rejected Status Display Test**:
   - Mock API to return leave requests with status "REJECTED" (will fail on unfixed code)
   - Render LeaveRequestScreen with rejected leaves
   - Assert status badge displays "REJECTED" text and red background (#FED7D7)
   - Compare against actual rendered output showing "PENDING"

**Expected Counterexamples**:
- Bug 1: Button shows "Fro..." or empty text instead of formatted date
- Bug 2: "Today" button does not exist in component tree
- Bug 3: Badge shows "PENDING" text and yellow background for rejected leaves
- Possible additional causes: Layout issues, API data issues, state management bugs

### Fix Checking

**Goal**: Verify that for all inputs where the bug conditions hold, the fixed function produces the expected behavior.

**Bug 1 - From Date Display Fix Checking:**
```
FOR ALL date WHERE isValidDate(date) DO
  setState({ startDate: date })
  fromButton := renderFromButton(state)
  ASSERT fromButton.text = `From: ${format(date, "DD/MM/YYYY")}`
  ASSERT fromButton.text is fully visible (not truncated)
END FOR
```

**Bug 2 - Today Button Fix Checking:**
```
FOR ALL dialogState WHERE dialogState.isOpen = true DO
  todayButton := findButton("Today")
  ASSERT todayButton EXISTS
  click(todayButton)
  ASSERT startDate = today AND endDate = today
  ASSERT fromButton.text = `From: ${format(today, "DD/MM/YYYY")}`
  ASSERT toButton.text = `To: ${format(today, "DD/MM/YYYY")}`
END FOR
```

**Bug 3 - Status Display Fix Checking:**
```
FOR ALL leave WHERE leave.status = "REJECTED" DO
  statusBadge := renderStatusBadge(leave)
  ASSERT statusBadge.text = "REJECTED"
  ASSERT statusBadge.backgroundColor = "#FED7D7"
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT (isBugCondition1(input) OR isBugCondition2(input) OR isBugCondition3(input)) DO
  ASSERT LeaveRequestScreen_original(input) = LeaveRequestScreen_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-buggy scenarios, then write property-based tests capturing that behavior.

**Test Cases**:

1. **To Date Button Preservation**: 
   - Observe: "To" button displays dates correctly on unfixed code
   - Test: For all valid dates, "To" button displays "To: DD/MM/YYYY" format
   - Verify: Same behavior after fix

2. **PENDING Status Preservation**:
   - Observe: PENDING leaves show yellow badge with "PENDING" text on unfixed code
   - Test: For all leaves with status "PENDING", badge shows yellow background and "PENDING" text
   - Verify: Same behavior after fix

3. **APPROVED Status Preservation**:
   - Observe: APPROVED leaves show green badge with "APPROVED" text on unfixed code
   - Test: For all leaves with status "APPROVED", badge shows green background and "APPROVED" text
   - Verify: Same behavior after fix

4. **Date Picker Preservation**:
   - Observe: Clicking date buttons opens date picker correctly on unfixed code
   - Test: For all date button clicks, DateTimePicker component appears and allows selection
   - Verify: Same behavior after fix

5. **Submission Preservation**:
   - Observe: Submitting leave with valid data works correctly on unfixed code
   - Test: For all valid submissions, API receives correct YYYY-MM-DD formatted dates and reason
   - Verify: Same behavior after fix

6. **Validation Preservation**:
   - Observe: Submitting without reason shows error alert on unfixed code
   - Test: For all submissions with empty reason, alert appears
   - Verify: Same behavior after fix

### Unit Tests

- Test "From" button renders with correct text for various dates (Bug 1)
- Test "Today" button exists and sets both dates to current date (Bug 2)
- Test status badge displays correct text and color for all three statuses (Bug 3)
- Test date picker opens when clicking date buttons
- Test form validation (reason required)
- Test leave submission with valid data
- Test edge cases: leap year dates, end-of-year dates, invalid date handling

### Property-Based Tests

- Generate random dates and verify "From" and "To" buttons display correctly (Bug 1 preservation)
- Generate random leave requests with all three status types and verify badge rendering (Bug 3 + preservation)
- Generate random form states and verify submission behavior is unchanged
- Test that non-buggy inputs produce identical outputs before and after fixes

### Integration Tests

- Test full flow: Open dialog → Click "Today" → Verify dates → Submit → Verify API call
- Test full flow: Select custom date range → Verify both buttons display correctly → Submit
- Test leave list rendering with mixed statuses (PENDING, APPROVED, REJECTED)
- Test date picker interaction with state updates
- Test error handling and loading states
