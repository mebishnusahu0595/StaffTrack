import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

import { api } from "./client";
import { API_ORIGIN_URL } from "../config/env";

export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ExpenseCategory = "TRAVEL" | "FOOD" | "ACCOMMODATION" | "OTHER";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE";

export type LatLng = {
  lat: number;
  lng: number;
};

export type WorkMode = "OFFICE" | "FIELD" | "BOTH";

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string | null;
  workMode?: WorkMode;
  shiftStart?: string;
  shiftEnd?: string;
  designation?: string | null;
  companyId: string;
  managerId?: string | null;
  groupId?: string | null;
  group?: {
    id: string;
    name: string;
    members: User[];
  } | null;
  createdAt?: string;
  trackingInterval?: number;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  taskType?: "NORMAL" | "DEALER" | "FARMER" | string;
  dueDate: string;
  lat?: number | null;
  lng?: number | null;
  location?: LatLng | null;
  assignedTo?: User;
  assignedBy?: User;
  isRepeating?: boolean;
  repeatFrequency?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  repeatDays?: string;
  repeatDates?: string;
  skipHolidays?: boolean;
  priority?: "High" | "Medium" | "Low";
  points?: number;
  completionPhotoUrl?: string | null;
  completionRemarks?: string | null;
  completionLat?: number | null;
  completionLng?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  checklist?: any[] | null;
  checklistResponses?: any[] | null;
  dealers?: Array<{ id: string; name: string; city?: string; state?: string; phone?: string; code?: string }> | null;
  isSubtask?: boolean;
  parentTask?: { id: string; title: string } | null;
  subtasks?: Task[] | null;
  createdAt?: string;
};

export type PunchType = "OFFICE" | "FIELD";

export type Break = {
  id: string;
  attendanceId: string;
  startTime: string;
  endTime?: string | null;
};

export type Attendance = {
  id: string;
  userId: string;
  date: string;
  punchType?: PunchType | null;
  checkInTime?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInPhotoUrl?: string | null;
  startOdometerPhotoUrl?: string | null;
  startOdometer?: number | null;
  checkOutTime?: string | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkOutPhotoUrl?: string | null;
  endOdometerPhotoUrl?: string | null;
  endOdometer?: number | null;
  status: AttendanceStatus;
  breaks?: Break[];
  isCheckInPending?: boolean;
  checkInApproved?: boolean;
  checkInApprovedBy?: string | null;
  checkInApprovedAt?: string | null;
};

export type DayEndReport = {
  id: string;
  userId: string;
  date: string;
  visitsSummary: string;
  ordersTaken: number;
  ordersCancelled: number;
  kmTravelled: number;
  totalKmTravelled?: number;
  kmPhotoUrl?: string;
  startOdometer?: number;
  endOdometer?: number;
  startOdometerPhotoUrl?: string;
  remarks: string;
  submittedAt: string;
  completedTasksCount?: number;
  pendingTasksCount?: number;
  taskPoints?: number;
  orderPoints?: number;
  kmPoints?: number;
  cancellationPenalty?: number;
  totalPoints?: number;
};

export type Expense = {
  id: string;
  userId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  receiptUrl: string;
  date: string;
  approved: boolean;
  approvedById?: string | null;
  createdAt?: string;
};

export type LocationPing = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
  batteryLevel?: number;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

type CreateDayEndReportPayload = {
  date: string;
  visitsSummary: string;
  ordersTaken: number;
  ordersCancelled: number;
  kmTravelled: number;
  totalKmTravelled?: number;
  kmPhotoUrl?: string;
  remarks: string;
};

type CreateExpensePayload = {
  category: ExpenseCategory;
  amount: number;
  description: string;
  receiptUrl: string;
  date: string;
};

export type CheckInPayload = LatLng & {
  punchType: PunchType;
  photoUrl?: string;
  startOdometerPhotoUrl?: string;
  startOdometer?: number;
  latitude?: number;
  longitude?: number;
  checkInAiAnalysis?: any;
};

export type CheckOutPayload = LatLng & {
  photoUrl?: string;
  endOdometerPhotoUrl?: string;
  endOdometer?: number;
  latitude?: number;
  longitude?: number;
  checkOutAiAnalysis?: any;
};

function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  if (!response.data.success || response.data.data === undefined) {
    throw new Error(response.data.message ?? response.data.error ?? "API request failed");
  }

  return response.data.data;
}

export async function login(payload: { email: string; password: string }): Promise<AuthResponse> {
  return unwrap(await api.post<ApiEnvelope<AuthResponse>>("/auth/login", payload));
}

export async function logout(refreshToken?: string): Promise<void> {
  await api.post("/auth/logout", { refreshToken: refreshToken ?? "mobile" });
}

export async function fetchTasks(date?: string | unknown): Promise<Task[]> {
  const params = typeof date === "string" ? { date } : undefined;
  return unwrap(await api.get<ApiEnvelope<Task[]>>("/tasks", { params }));
}

export async function updateTaskStatus(
  taskId: string, 
  status: TaskStatus, 
  completionData?: { photoUrl?: string; remarks?: string; lat?: number; lng?: number; checklistResponses?: any }
): Promise<Task> {
  return unwrap(await api.patch<ApiEnvelope<Task>>(`/tasks/${taskId}/status`, { status, completionData }));
}

export async function checkIn(payload: CheckInPayload): Promise<Attendance> {
  return unwrap(await api.post<ApiEnvelope<Attendance>>("/attendance/checkin", withCoordinateAliases(payload)));
}

export async function checkOut(payload: CheckOutPayload): Promise<Attendance> {
  return unwrap(await api.post<ApiEnvelope<Attendance>>("/attendance/checkout", withCoordinateAliases(payload)));
}

export async function analyzeFaceApi(imageData: string): Promise<any> {
  try {
    // imageData should be a base64 data URL: data:image/jpeg;base64,...
    const res = await api.post<ApiEnvelope<any>>("/attendance/analyze-face", { image: imageData }, { timeout: 20000 });
    return unwrap(res);
  } catch (err: any) {
    console.warn("[Mobile API] analyzeFaceApi offline/fallback:", err?.message || err);
    // If backend explicitly rejected the face (HTTP 400), propagate the error
    if (err?.response?.data?.error || err?.response?.data?.message) {
      const msg = err.response.data.error || err.response.data.message;
      return {
        isHumanFace: false,
        isScreenOrPrintout: false,
        confidence: 0,
        warningMessage: msg,
        networkFallback: false
      };
    }
    return {
      isHumanFace: true,
      isScreenOrPrintout: false,
      confidence: 0.5,
      warningMessage: "Weak network/offline check (logged for audit)",
      networkFallback: true
    };
  }
}

export async function analyzeOdometerApi(imageData: string): Promise<any> {
  try {
    const res = await api.post<ApiEnvelope<any>>("/attendance/analyze-odometer", { image: imageData }, { timeout: 20000 });
    return unwrap(res);
  } catch (err: any) {
    console.warn("[Mobile API] analyzeOdometerApi offline/fallback:", err?.message || err);
    return {
      isOdometer: true,
      isBlurry: false,
      isScreenOrPrintout: false,
      detectedReading: null,
      confidence: 0.5,
      warningMessage: "Weak network/offline check (logged for audit)",
      networkFallback: true
    };
  }
}

export async function startBreak(): Promise<Break> {
  return unwrap(await api.post<ApiEnvelope<Break>>("/attendance/break/start"));
}

export async function endBreak(): Promise<Break> {
  return unwrap(await api.post<ApiEnvelope<Break>>("/attendance/break/end"));
}

export async function uploadPhoto(asset: ImagePickerAsset): Promise<string> {
  console.log("[API] Preparing photo upload for:", asset.uri);
  const formData = new FormData();
  await appendImageAsset(formData, asset, `photo-${Date.now()}.jpg`);

  const response = await api.post<ApiEnvelope<{ url: string }>>(
    "/upload",
    formData,
    { 
      headers: {
        "Content-Type": "multipart/form-data",
      },
      transformRequest: (data) => data,
      timeout: 180000 
    }
  );

  console.log("[API] Upload response received:", response.data);
  if (!response.data.success) {
    throw new Error(response.data.message || "Photo upload failed");
  }
  
  const responseData = response.data as any;
  const url = responseData.data?.url ?? responseData.url;

  if (!url) {
    throw new Error("Photo upload did not return a URL");
  }

  return url;
}

export async function uploadFile(uri: string, name: string, mimeType: string): Promise<string> {
  console.log("[API] Preparing file upload for:", uri, name, mimeType);
  const formData = new FormData();
  
  const uploadUri = Platform.OS === "android" && !uri.startsWith("file://") && !uri.startsWith("content://")
    ? `file://${uri}`
    : uri;

  formData.append("file", {
    uri: uploadUri,
    name: name,
    type: mimeType
  } as unknown as Blob);

  const response = await api.post<ApiEnvelope<{ url: string }>>(
    "/upload",
    formData,
    { 
      headers: {
        "Content-Type": "multipart/form-data",
      },
      transformRequest: (data) => data,
      timeout: 180000 
    }
  );

  console.log("[API] Upload file response received:", response.data);
  if (!response.data.success) {
    throw new Error(response.data.message || "File upload failed");
  }
  
  const responseData = response.data as any;
  const url = responseData.data?.url ?? responseData.url;

  if (!url) {
    throw new Error("File upload did not return a URL");
  }

  return toAbsoluteUploadUrl(url);
}

export async function fetchMonthlyAttendance(
  userId: string,
  month: number,
  year: number
): Promise<Attendance[]> {
  return unwrap(
    await api.get<ApiEnvelope<Attendance[]>>(`/attendance/${userId}`, {
      params: { month, year }
    })
  );
}

export async function createDayEndReport(payload: CreateDayEndReportPayload & {
  startOdometer?: number;
  endOdometer?: number;
  startOdometerPhotoUrl?: string;
}): Promise<DayEndReport> {
  return unwrap(await api.post<ApiEnvelope<DayEndReport>>("/reports/der", payload));
}

export async function fetchDayEndReports(userId: string): Promise<DayEndReport[]> {
  return unwrap(await api.get<ApiEnvelope<DayEndReport[]>>(`/reports/der/${userId}`));
}

export async function fetchAllDayEndReports(): Promise<any[]> {
  return unwrap(await api.get<ApiEnvelope<any[]>>("/reports/der"));
}

export async function fetchDaySummary(userId: string, date: string): Promise<any> {
  return unwrap(
    await api.get<ApiEnvelope<any>>("/reports/day-summary", {
      params: { userId, date }
    })
  );
}

export async function fetchDerHtml(userId: string, date: string): Promise<string> {
  const res = await api.get<ApiEnvelope<{ html: string }>>("/reports/der/render-html", {
    params: { userId, date }
  });
  return unwrap(res).html;
}

export async function fetchMonthlyPerformanceReport(  
  userId: string,
  month: number,
  year: number
): Promise<any> {
  return unwrap(
    await api.get<ApiEnvelope<any>>(`/reports/monthly/${userId}`, {
      params: { month, year }
    })
  );
}

export async function uploadExpenseReceipt(asset: ImagePickerAsset): Promise<string> {
  const formData = new FormData();
  await appendImageAsset(formData, asset, `receipt-${Date.now()}.jpg`);

  const response = await api.post<ApiEnvelope<{ receiptUrl?: string; url?: string }>>(
    "/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      transformRequest: (data) => data
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Receipt upload failed");
  }

  const responseData = response.data as any;
  const receiptUrl = responseData.data?.receiptUrl ?? responseData.data?.url ?? responseData.receiptUrl ?? responseData.url;

  if (!receiptUrl) {
    throw new Error("Receipt upload did not return a URL");
  }

  return toAbsoluteUploadUrl(receiptUrl);
}

async function appendImageAsset(
  formData: FormData,
  asset: ImagePickerAsset,
  fallbackFileName: string
): Promise<void> {
  const fileName = asset.fileName ?? fallbackFileName;
  const mimeType = asset.mimeType ?? "image/jpeg";

  if (Platform.OS === "web") {
    const blob = await fetch(asset.uri).then((response) => response.blob());
    formData.append("file", blob, fileName);
    return;
  }

  const uri = Platform.OS === "android" && !asset.uri.startsWith("file://") && !asset.uri.startsWith("content://")
    ? `file://${asset.uri}`
    : asset.uri;

  formData.append("file", {
    uri,
    name: fileName,
    type: mimeType
  } as unknown as Blob);
}

export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  return unwrap(await api.post<ApiEnvelope<Expense>>("/expenses", {
    ...payload,
    receiptUrl: toAbsoluteUploadUrl(payload.receiptUrl)
  }));
}

export async function fetchExpenses(userId?: string): Promise<Expense[]> {
  return unwrap(
    await api.get<ApiEnvelope<Expense[]>>("/expenses", {
      params: userId ? { userId } : undefined
    })
  );
}

export type HolidayType = "HOLIDAY" | "PAID_LEAVE";

export type Holiday = {
  id: string;
  title: string;
  date: string;
  type: HolidayType;
  description?: string | null;
  companyId: string;
  groupId?: string | null;
  userId?: string | null;
};

export async function fetchHolidays(month: number, year: number): Promise<Holiday[]> {
  return unwrap(await api.get<ApiEnvelope<Holiday[]>>("/holidays", { params: { month, year } }));
}

export async function sendLocationLogs(logs: LocationPing[]): Promise<{ count: number }> {
  return unwrap(await api.post<ApiEnvelope<{ count: number }>>("/location", { logs }));
}

export async function fetchTodayLocationLogs(userId: string, date?: string): Promise<LocationPing[]> {
  return unwrap(await api.get<ApiEnvelope<LocationPing[]>>(`/location/${userId}/today`, { params: { date } }));
}

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export async function fetchNotifications(): Promise<AppNotification[]> {
  return unwrap(await api.get<ApiEnvelope<AppNotification[]>>("/notifications"));
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await api.patch("/notifications/read-all");
}

// Forms
export type FormField = {
  id: string;
  label: string;
  type: string; // text, number, select, photo, etc.
  required: boolean;
  options?: string | string[] | null;
};

export type Form = {
  id: string;
  name: string;
  category?: string | null;
  status: string;
  fields?: FormField[];
  createdAt: string;
  _count?: {
    responses: number;
  };
};

export async function fetchForms(): Promise<Form[]> {
  return unwrap(await api.get<ApiEnvelope<Form[]>>("/forms"));
}

export async function fetchFormDetails(formId: string): Promise<Form> {
  return unwrap(await api.get<ApiEnvelope<Form>>(`/forms/${formId}`));
}

export async function submitFormResponse(formId: string, data: any): Promise<void> {
  await api.post(`/forms/${formId}/submit`, data);
}

export async function createForm(data: any): Promise<Form> {
  return unwrap(await api.post<ApiEnvelope<Form>>("/forms", data));
}

function withCoordinateAliases<T extends Partial<LatLng> & { latitude?: number; longitude?: number }>(
  payload: T
): T & { latitude?: number; longitude?: number } {
  return {
    ...payload,
    latitude: payload.latitude ?? payload.lat,
    longitude: payload.longitude ?? payload.lng
  };
}

function toAbsoluteUploadUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_ORIGIN_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

// Issues
export type IssueStatus = "Open" | "In Progress" | "Resolved" | "Closed";
export type IssuePriority = "Low" | "Medium" | "High" | "Critical";

export type Issue = {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  category?: string;
  department?: string | null;
  startDate?: string;
  reportedBy?: { id: string; name: string };
  assignee?: { id: string; name: string };
  project?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchMyIssues(userId: string): Promise<Issue[]> {
  return unwrap(await api.get<ApiEnvelope<Issue[]>>("/issues", { params: { reportedById: userId } }));
}

export async function fetchAllIssues(): Promise<Issue[]> {
  return unwrap(await api.get<ApiEnvelope<Issue[]>>("/issues"));
}

export async function createIssue(payload: {
  title: string;
  description: string;
  priority: string;
  category?: string;
  department?: string;
  startDate?: string;
  assigneeId?: string;
}): Promise<Issue> {
  return unwrap(await api.post<ApiEnvelope<Issue>>("/issues", payload));
}

// Leaves
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export type LeaveRequest = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
};

export async function submitLeaveRequest(payload: { startDate: string; endDate: string; reason: string }): Promise<LeaveRequest> {
  return unwrap(await api.post<ApiEnvelope<LeaveRequest>>("/leaves", payload));
}

export async function fetchMyLeaves(): Promise<LeaveRequest[]> {
  return unwrap(await api.get<ApiEnvelope<LeaveRequest[]>>("/leaves"));
}

export async function fetchMusterReport(month: number, year: number): Promise<any> {
  return unwrap(await api.get<ApiEnvelope<any>>("/payroll/muster", { params: { month, year } }));
}

export async function updatePushToken(userId: string, token: string): Promise<User> {
  return unwrap(await api.patch<ApiEnvelope<User>>(`/users/${userId}`, { expoPushToken: token }));
}

export async function fetchUserProfile(userId: string): Promise<User> {
  return unwrap(await api.get<ApiEnvelope<User>>(`/users/${userId}`));
}

// Manager Specific Endpoints
export type CreateSubtaskPayload = {
  title: string;
  description?: string;
  assignedToId?: string;
  priority?: "High" | "Medium" | "Low";
  points?: number;
  dueDate?: string;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  dueDate: string;
  assignedToId: string;
  priority?: "High" | "Medium" | "Low";
  points?: number;
  subtasks?: CreateSubtaskPayload[];
};

export async function fetchUsers(): Promise<User[]> {
  const res = await api.get<ApiEnvelope<{ items: User[]; total: number }>>("/users", {
    params: { pageSize: 100 }
  });
  return unwrap(res).items;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  return unwrap(await api.post<ApiEnvelope<Task>>("/tasks", payload));
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}

export async function updateTask(taskId: string, payload: Partial<CreateTaskPayload> & { status?: TaskStatus }): Promise<Task> {
  return unwrap(await api.patch<ApiEnvelope<Task>>(`/tasks/${taskId}`, payload));
}

export type FormResponse = {
  id: string;
  formId: string;
  userId: string;
  data: string; // JSON string
  submittedAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    email: string;
  };
};

export async function fetchFormResponses(formId: string): Promise<FormResponse[]> {
  return unwrap(await api.get<ApiEnvelope<FormResponse[]>>(`/forms/${formId}/responses`));
}

export async function updateIssue(issueId: string, payload: { status?: IssueStatus; assigneeId?: string }): Promise<Issue> {
  return unwrap(await api.patch<ApiEnvelope<Issue>>(`/issues/${issueId}`, payload));
}

export async function fetchAttendanceByDate(date: string): Promise<any[]> {
  return unwrap(await api.get<ApiEnvelope<any[]>>("/attendance/by-date", { params: { date } }));
}

// Late check-in approvals (manager / admin)
export async function fetchPendingLateCheckIns(): Promise<any[]> {
  return unwrap(await api.get<ApiEnvelope<any[]>>("/attendance/late-checkins/pending"));
}

export async function approveLateCheckIn(id: string): Promise<any> {
  return unwrap(await api.post<ApiEnvelope<any>>(`/attendance/late-checkins/${id}/approve`));
}

export async function rejectLateCheckIn(id: string): Promise<any> {
  return unwrap(await api.post<ApiEnvelope<any>>(`/attendance/late-checkins/${id}/reject`));
}

// Team overview (manager / admin)
export async function fetchTeamMembers(): Promise<any[]> {
  return unwrap(await api.get<ApiEnvelope<any[]>>("/team/members"));
}

export async function fetchTeamOverview(params?: { month?: number; year?: number }): Promise<any> {
  return unwrap(await api.get<ApiEnvelope<any>>("/team/overview", { params }));
}

// Salary slips (employees see their own published slips)
export async function fetchSalarySlips(params?: { userId?: string; month?: number; year?: number }): Promise<any[]> {
  return unwrap(await api.get<ApiEnvelope<any[]>>("/salary-slips", { params }));
}

export type Template = {
  id: string;
  name: string;
  type: string;
  priority: string;
  recurrence: string;
  startTime?: string;
  dueTime?: string;
  description?: string;
  data?: string;
};

export async function fetchTemplates(params?: { type?: string; search?: string }): Promise<Template[]> {
  return unwrap(await api.get<ApiEnvelope<Template[]>>("/templates", { params }));
}

export async function updateLocationStatus(payload: { isLocationOn: boolean; batteryLevel?: number }): Promise<any> {
  return unwrap(await api.post<ApiEnvelope<any>>("/location/status", payload));
}

export async function sendForgotPasswordOtp(payload: { identifier: string }): Promise<{ verificationId: string; mobileNumber: string }> {
  return unwrap(await api.post<ApiEnvelope<{ verificationId: string; mobileNumber: string }>>("/auth/forgot-password/send-otp", payload));
}

export async function resetPassword(payload: { identifier: string; verificationId: string; code: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
  return unwrap(await api.post<ApiEnvelope<{ success: boolean; message: string }>>("/auth/forgot-password/reset", payload));
}

// Projects & Target Management
export type ProjectPeriodProgress = {
  id: string;
  assignmentId: string;
  periodType: string;
  periodIndex: number;
  periodName: string;
  startDate: string;
  endDate: string;
  baseTarget: number;
  carryover: number;
  effectiveTarget: number;
  completedCount: number;
  isCompleted: boolean;
};

export type UserProjectAssignment = {
  assignmentId: string;
  targetQuantity: number;
  completedCount: number;
  project: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    priority: string;
    targetType: string;
    startDate?: string | null;
    endDate?: string | null;
    department?: string | null;
  };
  periods: ProjectPeriodProgress[];
};

export async function fetchMyProjects(): Promise<UserProjectAssignment[]> {
  return unwrap(await api.get<ApiEnvelope<UserProjectAssignment[]>>("/projects/my-projects"));
}

export type ProjectProgressLog = {
  id: string;
  periodId: string;
  changedBy: string;
  previousCount: number;
  newCount: number;
  delta: number;
  note?: string | null;
  createdAt: string;
  user: {
    name: string;
    avatarUrl?: string | null;
  };
};

export async function fetchPeriodLogs(periodId: string): Promise<ProjectProgressLog[]> {
  return unwrap(await api.get<ApiEnvelope<ProjectProgressLog[]>>(`/projects/periods/${periodId}/logs`));
}

export async function updateProjectPeriodProgress(
  periodId: string,
  payload: { completedIncrement?: number; completedCount?: number; note?: string }
): Promise<any> {
  return unwrap(await api.patch<ApiEnvelope<any>>(`/projects/periods/${periodId}/progress`, payload));
}


export type CompanyFile = {
  id: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  fileType?: string | null;
  mimeType?: string | null;
  category?: string | null;
  createdAt: string;
  uploadedBy?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
};

export async function fetchCompanyDocuments(params?: { search?: string; category?: string }): Promise<CompanyFile[]> {
  return unwrap(await api.get<ApiEnvelope<CompanyFile[]>>("/documents", { params }));
}

// Daily Allowance
export type DailyAllowanceStatus = {
  gpsKm: number;
  thresholdExceeded: boolean;
  allowance?: {
    id: string;
    amount: number;
    remark?: string | null;
    gpsKm: number;
    submittedAt?: string;
  } | null;
};

export async function fetchDailyAllowanceStatus(): Promise<DailyAllowanceStatus> {
  return unwrap(await api.get<ApiEnvelope<DailyAllowanceStatus>>("/daily-allowance/today-status"));
}

export async function submitDailyAllowance(payload: { amount: number; remark?: string }): Promise<any> {
  return unwrap(await api.post<ApiEnvelope<any>>("/daily-allowance/submit", payload));
}

export async function fetchDailyAllowanceSubmissions(params?: { date?: string; startDate?: string; endDate?: string }): Promise<any[]> {
  return unwrap(await api.get<ApiEnvelope<any[]>>("/daily-allowance/submissions", { params }));
}


