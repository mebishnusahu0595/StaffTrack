# Bugfix Requirements Document

## Introduction

The Leave Request screen in the StaffTrack mobile app has three critical bugs affecting user experience and data display accuracy:

1. **From Date Button Display Bug**: The "From" date button in the "Apply for Leave" dialog shows placeholder text "Fro..." instead of displaying the actual selected date
2. **Missing Today Quick Select**: Users lack a convenient way to apply for single-day leave (today only) without manually selecting the same date twice
3. **Incorrect Leave Status Display Bug**: Rejected leave requests are incorrectly displaying status as "PENDING" instead of "REJECTED"

These bugs impact the leave management workflow, causing confusion and inefficiency for employees applying for and tracking their leave requests.

## Bug Analysis

### Current Behavior (Defect)

**Bug 1: From Date Button Not Showing Selected Date**

1.1 WHEN a user opens the "Apply for Leave" dialog and the startDate state has a value THEN the "From" date button displays placeholder text "Fro..." instead of the formatted date

1.2 WHEN a user selects a start date using the date picker THEN the "From" button continues to show "Fro..." instead of displaying the selected date in "From: DD/MM/YYYY" format

**Bug 2: Missing Today Quick Select**

1.3 WHEN a user wants to apply for single-day leave (today only) THEN the system requires manual selection of the same date twice for both "From" and "To" fields, creating unnecessary friction

**Bug 3: Incorrect Leave Status Display**

1.4 WHEN the backend API returns a leave request with status "REJECTED" (LeaveStatus type: "PENDING" | "APPROVED" | "REJECTED") THEN the UI displays "PENDING" in yellow background instead of "REJECTED" in red background

1.5 WHEN a user views their rejected leave requests in the list THEN the status badge shows "PENDING" instead of "REJECTED", causing confusion about the actual approval state

### Expected Behavior (Correct)

**Bug 1: From Date Button Display**

2.1 WHEN a user opens the "Apply for Leave" dialog with a selected startDate THEN the "From" button SHALL display the formatted date as "From: DD/MM/YYYY" matching the format used by the "To" button

2.2 WHEN a user selects a start date using the date picker THEN the "From" button SHALL immediately update to show "From: DD/MM/YYYY" with the selected date

**Bug 2: Today Quick Select**

2.3 WHEN a user clicks a "Today" button in the leave dialog THEN the system SHALL automatically set both startDate and endDate to today's date

2.4 WHEN the "Today" button is clicked THEN both the "From" and "To" buttons SHALL display today's date in "DD/MM/YYYY" format

**Bug 3: Correct Leave Status Display**

2.5 WHEN the backend API returns a leave request with status "REJECTED" THEN the UI SHALL display "REJECTED" in a red background badge (#FED7D7)

2.6 WHEN rendering the status badge for rejected leaves THEN the system SHALL use the correct status text from the leave.status field without alteration

### Unchanged Behavior (Regression Prevention)

**Existing Functionality That Must Be Preserved**

3.1 WHEN a user views leave requests with status "PENDING" THEN the system SHALL CONTINUE TO display "PENDING" in yellow background (#FEEBC8)

3.2 WHEN a user views leave requests with status "APPROVED" THEN the system SHALL CONTINUE TO display "APPROVED" in green background (#C6F6D5)

3.3 WHEN a user selects the "To" date THEN the system SHALL CONTINUE TO display it correctly as "To: DD/MM/YYYY" in the button

3.4 WHEN a user opens the date picker for either "From" or "To" dates THEN the system SHALL CONTINUE TO function as expected with the @react-native-community/datetimepicker component

3.5 WHEN a user submits a leave request THEN the system SHALL CONTINUE TO validate that a reason is provided and submit the correct date range in YYYY-MM-DD format to the backend

3.6 WHEN a user views the leave requests list THEN the system SHALL CONTINUE TO display the correct date range, reason, and creation date for all leave requests

3.7 WHEN the leave data loading state changes THEN the system SHALL CONTINUE TO display appropriate loading and empty state messages
