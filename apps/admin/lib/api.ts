"use client";

import axios from "axios";
import type {
  AttendanceRecord,
  DayEndReport,
  Expense,
  LocationLog,
  LoginResponse,
  Task,
  User,
  UserListResponse,
  WorkMode
} from "@/lib/types";
import { USER_COOKIE } from "@/lib/constants";

let isRedirectingToLogin = false;
let refreshRequest: Promise<void> | null = null;

const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
  withCredentials: true
});

async function refreshSession() {
  if (!refreshRequest) {
    refreshRequest = api
      .post<{ success: boolean }>("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

function redirectToLogin() {
  if (typeof window === "undefined" || isRedirectingToLogin) {
    return;
  }

  isRedirectingToLogin = true;
  
  // Clear cookies manually if possible or just rely on server-side logout
  document.cookie = `${USER_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
  document.cookie = `stafftrack_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
  
  const dest = window.location.pathname.startsWith("/superadmin") ? "/superadmin" : "/login";
  window.location.replace(dest);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    if (
      typeof window !== "undefined" &&
      error.response?.status === 401 &&
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/superadmin" &&
      originalRequest &&
      !originalRequest._retry &&
      !String(originalRequest.url ?? "").includes("/auth/refresh")
    ) {
      try {
        originalRequest._retry = true;
        await refreshSession();
        return api(originalRequest);
      } catch {
        redirectToLogin();
      }
    }

    if (
      typeof window !== "undefined" &&
      error.response?.status === 401 &&
      window.location.pathname !== "/login" &&
      window.location.pathname !== "/superadmin" &&
      !String(originalRequest?.url ?? "").includes("/auth/refresh") &&
      !String(originalRequest?.url ?? "").includes("/auth/login")
    ) {
      console.error("[AXIOS INTERCEPTOR] 401 Unauthorized detected for:", error.config?.url);
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export async function login(input: { email: string; password: string }) {
  const response = await api.post<{ data: LoginResponse }>("/auth/login", input);
  return response.data.data;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function fetchUsers(params?: { 
  page?: number; 
  pageSize?: number;
  search?: string;
  workMode?: string;
  role?: "EMPLOYEE" | "MANAGER" | "ALL";
}) {
  const response = await api.get<{ data: { items: User[]; total: number } }>("/users", { 
    params: {
      ...params,
      workMode: params?.workMode === "ALL" ? undefined : params?.workMode
    } 
  });
  return response.data.data;
}

export async function fetchEmployees(search?: string) {
  const data = await fetchUsers({ page: 1, pageSize: 1000, search, role: "EMPLOYEE" });
  return data.items;
}


export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: "EMPLOYEE" | "MANAGER";
  workMode: WorkMode;
  designation?: string;
  joiningDate?: Date;
  shiftStart?: string;
  shiftEnd?: string;
  companyId?: string;
  managerId?: string;
  groupId?: string;
  avatarUrl?: string;
  baseSalary?: number;
}) {
  const response = await api.post<{ data: User }>("/users", input);
  return response.data.data;
}

export async function updateUser(
  id: string,
  input: {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    workMode?: WorkMode;
    designation?: string;
    joiningDate?: Date;
    shiftStart?: string;
    shiftEnd?: string;
    managerId?: string | null;
    groupId?: string | null;
    avatarUrl?: string;
    baseSalary?: number;
  }
) {
  const response = await api.patch<{ data: User }>(`/users/${id}`, input);
  return response.data.data;
}

export async function fetchUser(id: string) {
  const response = await api.get<{ data: User }>(`/users/${id}`);
  return response.data.data;
}

export async function fetchTasks() {
  const response = await api.get<{ data: Task[] }>("/tasks");
  return response.data.data;
}

export async function createTask(input: {
  title: string;
  description: string;
  assignedToId: string;
  dueDate: string;
  lat?: number;
  lng?: number;
  isRepeating?: boolean;
  repeatFrequency?: string;
  repeatDays?: string;
  repeatDates?: string;
  skipHolidays?: boolean;
  priority?: string;
  points?: number;
  startDate?: string | null;
  endDate?: string | null;
  validations?: string[];
  checklist?: any[];
  geofenceLat?: number | null;
  geofenceLng?: number | null;
  geofenceRadius?: number | null;
  reminder?: number | null;
  subtasks?: any[];
  projectId?: string | null;
  templateId?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  taskType?: string;
}) {
  const response = await api.post<{ data: Task }>("/tasks", input);
  return response.data.data;
}

export async function updateTaskStatus(id: string, status: Task["status"]) {
  const response = await api.patch<{ data: Task }>(`/tasks/${id}`, { status });
  return response.data.data;
}

export async function updateTask(id: string, input: any) {
  const response = await api.patch<{ data: Task }>(`/tasks/${id}`, input);
  return response.data.data;
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`);
}

export async function bulkDeleteTasks(ids: string[]) {
  const response = await api.post<{ data: { count: number } }>("/tasks/bulk-delete", { ids });
  return response.data.data;
}

export async function deleteAllTasks() {
  const response = await api.delete<{ data: { count: number } }>(`/tasks/all`);
  return response.data.data;
}

export async function fetchAttendance(userId: string, params?: { month?: number; year?: number }) {
  const response = await api.get<{ data: AttendanceRecord[] }>(`/attendance/${userId}`, { params });
  return response.data.data;
}

export async function fetchAllCompanyAttendance(params?: { month?: number; year?: number }) {
  const response = await api.get<{ data: AttendanceRecord[] }>("/attendance/company/all", { params });
  return response.data.data;
}

export async function fetchDerHistory(userId: string) {
  const response = await api.get<{ data: DayEndReport[] }>(`/reports/der/${userId}`);
  return response.data.data;
}

export async function fetchAllReports(userId?: string) {
  const response = await api.get<{ data: (DayEndReport & { user: User })[] }>("/reports/der", {
    params: { userId }
  });
  return response.data.data;
}

export async function fetchMonthlyReport(userId: string, month: number, year: number) {
  const response = await api.get<{ data: any }>(`/reports/monthly/${userId}`, {
    params: { month, year }
  });
  return response.data.data;
}

export async function fetchDaySummary(userId: string, date: string) {
  const response = await api.get<{ data: any }>(`/reports/day-summary`, {
    params: { userId, date }
  });
  return response.data.data;
}

export async function fetchExpenses(params?: { userId?: string; date?: string }) {
  const response = await api.get<{ data: Expense[] }>("/expenses", { params });
  return response.data.data;
}

// Projects
export async function fetchProjects(params?: { search?: string }) {
  const response = await api.get<{ data: any[] }>("/projects", { params });
  return response.data.data;
}

export async function createProject(data: { name: string; description?: string; status?: string; [key: string]: any }) {
  const response = await api.post<{ data: any }>("/projects", data);
  return response.data.data;
}

export async function updateProject(id: string, data: { name?: string; description?: string; status?: string; [key: string]: any }) {
  const response = await api.patch<{ data: any }>(`/projects/${id}`, data);
  return response.data.data;
}

export async function deleteProject(id: string) {
  await api.delete(`/projects/${id}`);
}

export async function updatePeriodProgress(periodId: string, input: { completedIncrement?: number; completedCount?: number }) {
  const response = await api.patch<{ data: any }>(`/projects/periods/${periodId}/progress`, input);
  return response.data.data;
}

// Issues
export async function fetchIssues(params?: { search?: string; priority?: string; status?: string }) {
  const response = await api.get<{ data: any[] }>("/issues", { params });
  return response.data.data;
}

export async function fetchIssue(id: string) {
  const response = await api.get<{ data: any }>(`/issues/${id}`);
  return response.data.data;
}

export async function createIssue(data: any) {
  const response = await api.post<{ data: any }>("/issues", data);
  return response.data.data;
}

export async function updateIssue(id: string, data: any) {
  const response = await api.patch<{ data: any }>(`/issues/${id}`, data);
  return response.data.data;
}

export async function addIssueUpdate(issueId: string, data: any) {
  const response = await api.post<{ data: any }>(`/issues/${issueId}/updates`, data);
  return response.data.data;
}

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{ success: boolean; url: string }>("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return response.data.url;
}

// Forms
export async function fetchForms(params?: { search?: string; status?: string }) {
  const response = await api.get<{ data: any[] }>("/forms", { params });
  return response.data.data;
}

export async function createForm(data: any) {
  const response = await api.post<{ data: any }>("/forms", data);
  return response.data.data;
}

export async function fetchForm(id: string) {
  const response = await api.get<{ data: any }>(`/forms/${id}`);
  return response.data.data;
}

export async function updateForm(id: string, data: any) {
  const response = await api.patch<{ data: any }>(`/forms/${id}`, data);
  return response.data.data;
}

export async function deleteForm(id: string) {
  await api.delete(`/forms/${id}`);
}

export async function fetchFormResponses(id: string) {
  const response = await api.get<{ data: any[] }>(`/forms/${id}/responses`);
  return response.data.data;
}

export async function fetchUserFormResponses(userId: string) {
  const response = await api.get<{ data: any[] }>(`/forms/responses/user/${userId}`);
  return response.data.data;
}

export async function sendBroadcast(data: {
  userIds?: string[];
  allSelected?: boolean;
  title: string;
  message: string;
}) {
  const response = await api.post<{ success: boolean; count: number }>("/notifications/broadcast", data);
  return response.data;
}

// Templates
export async function fetchTemplates(params?: { type?: string; search?: string }) {
  const response = await api.get<{ data: any[] }>("/templates", { params });
  return response.data.data;
}

export async function createTemplate(data: any) {
  const response = await api.post<{ data: any }>("/templates", data);
  return response.data.data;
}

export async function updateTemplate(id: string, data: any) {
  const response = await api.put<{ data: any }>(`/templates/${id}`, data);
  return response.data.data;
}

export async function deleteTemplateTasks(id: string, option: string) {
  const response = await api.delete<{ data: any }>(`/templates/${id}/tasks`, { data: { option } });
  return response.data.data;
}

export async function deleteTemplate(id: string, deleteTasksOption?: string) {
  const response = await api.delete<{ data: any }>(`/templates/${id}`, { params: { deleteTasksOption } });
  return response.data.data;
}

export async function cleanupTemplateDuplicates(id: string) {
  const response = await api.post<{ data: any }>(`/templates/${id}/cleanup-duplicates`);
  return response.data.data;
}

// Groups
export async function fetchGroups() {
  const response = await api.get<{ data: any[] }>("/groups");
  return response.data.data;
}

export async function createGroup(data: { name: string; baseSalary: number; userIds?: string[] }) {
  const response = await api.post<{ data: any }>("/groups", data);
  return response.data.data;
}

export async function updateGroup(id: string, data: { name?: string; baseSalary?: number; userIds?: string[] }) {
  const response = await api.patch<{ data: any }>(`/groups/${id}`, data);
  return response.data.data;
}

export async function deleteGroup(id: string) {
  await api.delete(`/groups/${id}`);
}

// Holidays
export async function fetchHolidays() {
  const response = await api.get<{ data: any[] }>("/holidays");
  return response.data.data;
}

export async function createHoliday(data: { date: Date; name: string; type: string; groupId?: string; userId?: string; userIds?: string[] }) {
  const response = await api.post<{ data: any }>("/holidays", data);
  return response.data.data;
}

// Payroll
export async function fetchPayrollReport(params?: { month: number; year: number }) {
  const response = await api.get<{ data: any[] }>("/payroll/report", { params });
  return response.data.data;
}

export async function fetchSalaryMatrix(params?: { month: number; year: number }) {
  const response = await api.get<{ data: any[] }>("/payroll/matrix", { params });
  return response.data.data;
}

export async function clearAttendanceStatus(input: { userId: string; date: string }) {
  const response = await api.post<{ data: any }>("/attendance/clear", input);
  return response.data.data;
}



export async function approveExpense(id: string, approved: boolean | null) {
  const response = await api.patch<{ data: Expense }>(`/expenses/${id}/approve`, { approved });
  return response.data.data;
}

export async function fetchTodayLocation(userId: string, date?: string) {
  const response = await api.get<{ data: LocationLog[] }>(`/location/${userId}/today`, { params: { date } });
  return response.data.data;
}

export async function fetchAllAttendance(date?: string, startDate?: string, endDate?: string) {
  const response = await api.get<{ data: (AttendanceRecord & { user: User })[] }>("/attendance", { params: { date, startDate, endDate } });
  return response.data.data;
}

export async function markAttendanceStatus(input: {
  userId: string;
  date: string;
  status: "ON_LEAVE" | "HALF_DAY";
}) {
  const response = await api.post<{ data: AttendanceRecord }>("/attendance", input);
  return response.data.data;
}

export async function deleteUser(id: string) {
  await api.delete(`/users/${id}`);
}

// SuperAdmin Endpoints
export async function superFetchUsers() {
  const response = await api.get<{ data: User[] }>("/superadmin/users");
  return response.data.data;
}

export async function superUpdateUser(id: string, input: Partial<User>) {
  const response = await api.patch<{ data: User }>(`/superadmin/users/${id}`, input);
  return response.data.data;
}

export async function superFetchManagers() {
  const response = await api.get<{ data: { id: string; name: string; role: string }[] }>("/superadmin/managers");
  return response.data.data;
}

export async function superFetchAttendance(userId?: string, date?: string) {
  const response = await api.get<{ data: (AttendanceRecord & { user: { name: string; email: string } })[] }>("/superadmin/attendance", {
    params: { userId, date }
  });
  return response.data.data;
}

export async function superUpdateAttendance(id: string, input: Partial<AttendanceRecord>) {
  const response = await api.patch<{ data: AttendanceRecord }>(`/superadmin/attendance/${id}`, input);
  return response.data.data;
}

// SuperAdmin Expenses
export async function superFetchExpenses() {
  const response = await api.get<{ data: any[] }>("/superadmin/expenses");
  return response.data.data;
}

export async function superUpdateExpense(id: string, input: any) {
  const response = await api.patch<{ data: any }>(`/superadmin/expenses/${id}`, input);
  return response.data.data;
}

export async function superDeleteExpense(id: string) {
  const response = await api.delete(`/superadmin/expenses/${id}`);
  return response.data;
}

// SuperAdmin Leaves
export async function superFetchLeaves() {
  const response = await api.get<{ data: any[] }>("/superadmin/leaves");
  return response.data.data;
}

export async function superUpdateLeave(id: string, input: any) {
  const response = await api.patch<{ data: any }>(`/superadmin/leaves/${id}`, input);
  return response.data.data;
}

export async function superDeleteLeave(id: string) {
  const response = await api.delete(`/superadmin/leaves/${id}`);
  return response.data;
}

// SuperAdmin Tasks
export async function superFetchTasks() {
  const response = await api.get<{ data: any[] }>("/superadmin/tasks");
  return response.data.data;
}

export async function superUpdateTask(id: string, input: any) {
  const response = await api.patch<{ data: any }>(`/superadmin/tasks/${id}`, input);
  return response.data.data;
}

export async function superDeleteTask(id: string) {
  const response = await api.delete(`/superadmin/tasks/${id}`);
  return response.data;
}

export async function superBulkMarkAttendance(input: any) {
  const response = await api.post("/superadmin/attendance/bulk", input);
  return response.data;
}



// Leaves
export async function fetchLeaves(params?: { status?: string; userId?: string }) {
  const response = await api.get<{ data: any[] }>("/leaves", { params });
  return response.data.data;
}

export async function updateLeaveStatus(id: string, status: "APPROVED" | "REJECTED") {
  const response = await api.patch<{ data: any }>(`/leaves/${id}/status`, { status });
  return response.data.data;
}

export async function submitLeaveRequest(data: { startDate: string; endDate: string; reason: string; userId?: string; status?: string }) {
  const response = await api.post<{ data: any }>("/leaves", data);
  return response.data.data;
}

// Muster Report
export async function fetchMusterReport(params: { month: number; year: number }) {
  const response = await api.get<{ data: any }>("/payroll/muster", { params });
  return response.data.data;
}

// New Attendance Dashboard & Approval Requests endpoints
export async function fetchAttendanceDashboardSummary(date?: string) {
  const response = await api.get<{ data: any }>("/attendance/dashboard/summary", { params: { date } });
  return response.data.data;
}

export async function fetchAttendanceRequests(status?: string) {
  const response = await api.get<{ data: any[] }>("/attendance/requests/all", { params: { status } });
  return response.data.data;
}

export async function approveAttendanceRequest(id: string) {
  const response = await api.post<{ data: any }>(`/attendance/requests/${id}/approve`);
  return response.data.data;
}

export async function rejectAttendanceRequest(id: string) {
  const response = await api.post<{ data: any }>(`/attendance/requests/${id}/reject`);
  return response.data.data;
}

// Late Check-in Approvals
export async function fetchPendingLateCheckIns() {
  const response = await api.get<{ data: any[] }>("/attendance/late-checkins/pending");
  return response.data.data;
}

export async function approveLateCheckIn(id: string) {
  const response = await api.post<{ data: any }>(`/attendance/late-checkins/${id}/approve`);
  return response.data.data;
}

export async function rejectLateCheckIn(id: string) {
  const response = await api.post<{ data: any }>(`/attendance/late-checkins/${id}/reject`);
  return response.data.data;
}

// Leave Types & Holiday Templates
export async function fetchLeaveTypes() {
  const response = await api.get<{ data: any[] }>("/leaves/types");
  return response.data.data;
}

export async function createLeaveType(data: {
  name: string;
  alias: string;
  description?: string;
  autoAllocationCount: number;
  autoAllocationFreq: string;
  carryForward: number;
  carryForwardFreq: string;
  encashment: boolean;
  leaveCycle: string;
}) {
  const response = await api.post<{ data: any }>("/leaves/types", data);
  return response.data.data;
}

export async function updateLeaveType(id: string, data: {
  name: string;
  alias: string;
  description?: string;
  autoAllocationCount: number;
  autoAllocationFreq: string;
  carryForward: number;
  carryForwardFreq: string;
  encashment: boolean;
  leaveCycle: string;
}) {
  const response = await api.put<{ data: any }>(`/leaves/types/${id}`, data);
  return response.data.data;
}

export async function deleteLeaveType(id: string) {
  const response = await api.delete<{ data: any }>(`/leaves/types/${id}`);
  return response.data.data;
}

export async function fetchHolidayTemplates() {
  const response = await api.get<{ data: any[] }>("/leaves/holiday-templates");
  return response.data.data;
}

export async function createHolidayTemplate(data: {
  name: string;
  holidays: { date: string; name: string; description?: string }[];
}) {
  const response = await api.post<{ data: any }>("/leaves/holiday-templates", data);
  return response.data.data;
}

export async function updateHolidayTemplate(id: string, data: {
  name: string;
  holidays: { date: string; name: string; description?: string }[];
  deleteOption: "future" | "present" | "all";
}) {
  const response = await api.put<{ data: any }>(`/leaves/holiday-templates/${id}`, data);
  return response.data.data;
}

export async function deleteHolidayTemplate(id: string, deleteOption: "future" | "present" | "all") {
  const response = await api.delete<{ data: any }>(`/leaves/holiday-templates/${id}?deleteOption=${deleteOption}`);
  return response.data.data;
}

export async function assignHolidayTemplate(data: {
  templateId: string;
  userIds: string[];
}) {
  const response = await api.post<{ data: any }>("/leaves/holiday-templates/assign", data);
  return response.data.data;
}

export async function forceCheckoutUser(userId: string) {
  const response = await api.post<{ data: any }>("/attendance/force-checkout", { userId });
  return response.data.data;
}

// Team overview (manager / admin)
export async function fetchTeamMembers(params?: { managerId?: string }) {
  const response = await api.get<{ data: any[] }>("/team/members", { params });
  return response.data.data;
}

export async function fetchTeamOverview(params?: { month?: number; year?: number; managerId?: string }) {
  const response = await api.get<{ data: any }>("/team/overview", { params });
  return response.data.data;
}

// Salary slips
export async function fetchSalarySlips(params?: { userId?: string; month?: number; year?: number }) {
  const response = await api.get<{ data: any[] }>("/salary-slips", { params });
  return response.data.data;
}

export async function saveSalarySlip(payload: any) {
  const response = await api.post<{ data: any }>("/salary-slips", payload);
  return response.data.data;
}

export async function setSalarySlipStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  const response = await api.patch<{ data: any }>(`/salary-slips/${id}/status`, { status });
  return response.data.data;
}

export async function deleteSalarySlip(id: string) {
  const response = await api.delete<{ data: any }>(`/salary-slips/${id}`);
  return response.data.data;
}

export async function superUpdateTravelDistance(payload: { userId: string; date: string; km: number }) {
  const response = await api.patch<{ success: boolean }>("/superadmin/travel", payload);
  return response.data;
}

export async function fetchDocuments(params?: { search?: string; category?: string }) {
  const response = await api.get<{ data: any[] }>("/documents", { params });
  return response.data.data;
}

export async function createDocument(payload: {
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  mimeType?: string;
  category?: string;
}) {
  const response = await api.post<{ data: any }>("/documents", payload);
  return response.data.data;
}

export async function deleteDocument(id: string) {
  const response = await api.delete<{ data: any }>(`/documents/${id}`);
  return response.data.data;
}

// Dealers
export async function fetchDealers() {
  const response = await api.get<{ data: any[] }>("/dealers");
  return response.data.data;
}

export async function fetchDealer(id: string) {
  const response = await api.get<{ data: any }>(`/dealers/${id}`);
  return response.data.data;
}

export async function createDealer(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
}) {
  const response = await api.post<{ data: any }>("/dealers", data);
  return response.data.data;
}

export async function updateDealer(id: string, data: any) {
  const response = await api.put<{ data: any }>(`/dealers/${id}`, data);
  return response.data.data;
}

export async function deleteDealer(id: string) {
  const response = await api.delete<{ data: any }>(`/dealers/${id}`);
  return response.data.data;
}




