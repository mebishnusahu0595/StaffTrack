# Implementation Plan

## Phase 1: Exploration - Understand the Bugs

- [ ] 1. Write bug condition exploration tests (BEFORE implementing fixes)
  - **Property 1: Bug Condition** - From Date Display, Today Quick Select, and Rejected Status Bugs
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failures confirm the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate all three bugs exist
  - **Test Structure**: Write separate test cases for each bug condition
  
  ### Bug 1: From Date Button Display Test
  - Test that "From" button displays formatted date "From: DD/MM/YYYY" when startDate is set
  - Use React Native Testing Library to render LeaveRequestScreen
  - Open the dialog, find the "From" button
  - Assert button text contains "From: " followed by today's date in DD/MM/YYYY format
  - Select a specific date (e.g., Feb 15, 2025) and assert button updates to "From: 15/02/2025"
  - **Scoped PBT Approach**: Test with a concrete failing case first (today's date), then test with other specific dates
  - From Bug Condition in design: `isBugCondition1` - button should show formatted date but shows "Fro..."
  - Expected behavior: Button displays "From: DD/MM/YYYY" matching Property 1 specification
  
  ### Bug 2: Today Quick Select Test
  - Test that "Today" button exists in the leave dialog
  - Search for a button with text "Today" or testID "today-button"
  - Test that clicking "Today" button sets both startDate and endDate to today
  - Assert both date buttons display today's date after clicking "Today"
  - **Scoped PBT Approach**: Test the concrete case of clicking "Today" once
  - From Bug Condition in design: `isBugCondition2` - "Today" button does not exist
  - Expected behavior: Button exists and sets both dates to today matching Property 2 specification
  
  ### Bug 3: Rejected Status Display Test
  - Mock the leave requests API to return leaves with status "REJECTED"
  - Render LeaveRequestScreen with rejected leaves in the list
  - Find the status badge for rejected leave
  - Assert badge displays text "REJECTED" (not "PENDING")
  - Assert badge background color is "#FED7D7" (red, not yellow)
  - **Scoped PBT Approach**: Test with a concrete rejected leave object
  - From Bug Condition in design: `isBugCondition3` - rejected leaves show "PENDING" instead of "REJECTED"
  - Expected behavior: Badge shows "REJECTED" with red background matching Property 3 specification
  
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All three test cases FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found:
    - Bug 1: Button shows "Fro..." instead of formatted date
    - Bug 2: "Today" button does not exist in component
    - Bug 3: Rejected leaves show "PENDING" badge instead of "REJECTED"
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

## Phase 2: Preservation - Verify Existing Behavior

- [ ] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 4: Preservation** - Non-Buggy Input Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - **GOAL**: Capture existing correct behavior that must not be broken by the fixes
  
  ### Preservation Test 1: To Date Button Display
  - Observe: "To" button displays dates correctly on unfixed code
  - Set endDate to a specific date (e.g., Feb 20, 2025)
  - Assert "To" button displays "To: 20/02/2025"
  - Write property: For all valid dates, "To" button displays "To: DD/MM/YYYY" format
  - From Preservation Requirements: Requirement 3.3
  
  ### Preservation Test 2: PENDING Status Display
  - Observe: PENDING leaves show yellow badge with "PENDING" text on unfixed code
  - Mock API to return leaves with status "PENDING"
  - Assert badge displays "PENDING" text
  - Assert badge background color is "#FEEBC8" (yellow)
  - Write property: For all leaves with status "PENDING", display yellow badge
  - From Preservation Requirements: Requirement 3.1
  
  ### Preservation Test 3: APPROVED Status Display
  - Observe: APPROVED leaves show green badge with "APPROVED" text on unfixed code
  - Mock API to return leaves with status "APPROVED"
  - Assert badge displays "APPROVED" text
  - Assert badge background color is "#C6F6D5" (green)
  - Write property: For all leaves with status "APPROVED", display green badge
  - From Preservation Requirements: Requirement 3.2
  
  ### Preservation Test 4: Date Picker Functionality
  - Observe: Date picker opens when clicking date buttons on unfixed code
  - Click "From" button and verify DateTimePicker component appears
  - Click "To" button and verify DateTimePicker component appears
  - Write property: For all date button clicks, picker opens correctly
  - From Preservation Requirements: Requirement 3.4
  
  ### Preservation Test 5: Form Submission
  - Observe: Submitting leave with valid data works on unfixed code
  - Fill in dates and reason
  - Submit form
  - Assert API is called with correct YYYY-MM-DD formatted dates
  - Write property: For all valid submissions, correct data is sent
  - From Preservation Requirements: Requirement 3.5
  
  ### Preservation Test 6: Form Validation
  - Observe: Submitting without reason shows error on unfixed code
  - Leave reason field empty
  - Attempt to submit
  - Assert error alert appears
  - Write property: For all submissions with empty reason, validation fails
  - From Preservation Requirements: Requirement 3.5
  
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

## Phase 3: Implementation - Apply the Fixes

- [ ] 3. Implement all three bug fixes in LeaveRequestScreen.tsx

  - [ ] 3.1 Fix Bug 1: From Date Button Display
    - Open `apps/mobile/src/screens/LeaveRequestScreen.tsx`
    - Locate the "From" date button (around line 92-94)
    - **Root Cause**: Text truncation or missing Text wrapper
    - **Solution Options**:
      - Option A: Wrap button content in `<Text>` component
      - Option B: Use button `labelStyle` prop to prevent truncation
      - Option C: Match the "To" button implementation pattern exactly
    - Verify button renders formatted date without truncation
    - Test with various date lengths (e.g., "31/12/2024")
    - _Bug_Condition: isBugCondition1 from design - startDate exists but button shows "Fro..."_
    - _Expected_Behavior: Button displays "From: DD/MM/YYYY" (Property 1 from design)_
    - _Preservation: To button, date picker, submission must remain unchanged (Requirements 3.3, 3.4, 3.5)_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.2 Fix Bug 2: Add Today Quick Select Button
    - Open `apps/mobile/src/screens/LeaveRequestScreen.tsx`
    - Add "Today" button in the leave dialog (around line 91, before date buttons)
    - **Implementation**:
      ```tsx
      <Button 
        mode="contained" 
        onPress={() => {
          const today = new Date();
          setStartDate(today);
          setEndDate(today);
        }}
        style={{ marginBottom: 12 }}
        testID="today-button"
      >
        Today
      </Button>
      ```
    - Create handler function that sets both `startDate` and `endDate` to `new Date()`
    - Verify both date buttons update to show today's date after clicking "Today"
    - Position button for easy access and good UX
    - _Bug_Condition: isBugCondition2 from design - no quick select for today_
    - _Expected_Behavior: Button sets both dates to today (Property 2 from design)_
    - _Preservation: Date picker, existing date selection, submission must remain unchanged (Requirements 3.4, 3.5)_
    - _Requirements: 2.3, 2.4_

  - [ ] 3.3 Fix Bug 3: Correct Rejected Status Display
    - Open `apps/mobile/src/screens/LeaveRequestScreen.tsx`
    - Locate status badge rendering logic (around lines 72-77)
    - **Root Cause Investigation**:
      - Add console.log to verify `leave.status` value at render time
      - Check if backend is returning correct status
      - Verify no data transformation is modifying status
    - **If Frontend Fix Needed**:
      - Review conditional logic for background color (line 74)
      - Review text rendering (line 77) to ensure `leave.status` displays correctly
      - Consider refactoring to explicit switch statement for clarity
    - **If Backend Issue**:
      - Document findings and coordinate with backend team
      - Consider defensive coding approach if needed
    - Verify status badge displays "REJECTED" text with red background (#FED7D7)
    - Test with multiple rejected leaves to ensure consistency
    - _Bug_Condition: isBugCondition3 from design - status="REJECTED" but shows "PENDING"_
    - _Expected_Behavior: Badge displays "REJECTED" with red background (Property 3 from design)_
    - _Preservation: PENDING and APPROVED status display must remain unchanged (Requirements 3.1, 3.2)_
    - _Requirements: 2.5, 2.6_

## Phase 4: Validation - Verify Fixes and Preservation

  - [ ] 3.4 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - All Three Bugs Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - Run all three test cases from task 1:
      - Bug 1: From Date Button Display Test
      - Bug 2: Today Quick Select Test
      - Bug 3: Rejected Status Display Test
    - **EXPECTED OUTCOME**: All three test cases PASS (confirms bugs are fixed)
    - If any test fails, debug and fix the implementation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 4: Preservation** - No Regressions
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run all six preservation test cases from task 2:
      - Preservation Test 1: To Date Button Display
      - Preservation Test 2: PENDING Status Display
      - Preservation Test 3: APPROVED Status Display
      - Preservation Test 4: Date Picker Functionality
      - Preservation Test 5: Form Submission
      - Preservation Test 6: Form Validation
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - If any test fails, the fix introduced a regression - debug and correct
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

## Phase 5: Final Verification

- [ ] 4. Checkpoint - Ensure all tests pass and perform manual testing
  - Run complete test suite (exploration + preservation tests)
  - Verify all tests pass successfully
  - Perform manual testing in the mobile app:
    - Open Leave Request screen
    - Verify "From" button displays date correctly (not "Fro...")
    - Click "Today" button and verify both dates are set to today
    - Check rejected leave requests show "REJECTED" in red badge
    - Verify PENDING shows in yellow, APPROVED shows in green
    - Test date picker still works for both From and To dates
    - Test form submission with valid and invalid data
  - If any issues arise, ask user for clarification before proceeding
  - Document any edge cases or additional findings
