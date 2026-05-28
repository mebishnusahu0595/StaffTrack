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
};

export type CheckOutPayload = LatLng & {
  photoUrl?: string;
  endOdometerPhotoUrl?: string;
  endOdometer?: number;
  latitude?: number;
  longitude?: number;
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

export async function fetchTasks(): Promise<Task[]> {
  return unwrap(await api.get<ApiEnvelope<Task[]>>("/tasks"));
}

export async function updateTaskStatus(
  taskId: string, 
  status: TaskStatus, 
  completionData?: { photoUrl?: string; remarks?: string; lat?: number; lng?: number }
): Promise<Task> {
  return unwrap(await api.patch<ApiEnvelope<Task>>(`/tasks/${taskId}/status`, { status, completionData }));
}

export async function checkIn(payload: CheckInPayload): Promise<Attendance> {
  return unwrap(await api.post<ApiEnvelope<Attendance>>("/attendance/checkin", withCoordinateAliases(payload)));
}

export async function checkOut(payload: CheckOutPayload): Promise<Attendance> {
  return unwrap(await api.post<ApiEnvelope<Attendance>>("/attendance/checkout", withCoordinateAliases(payload)));
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
      timeout: 60000 
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
export type CreateTaskPayload = {
  title: string;
  description?: string;
  dueDate: string;
  assignedToId: string;
  priority?: "High" | "Medium" | "Low";
  points?: number;
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

