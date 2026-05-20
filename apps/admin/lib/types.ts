export type Role = "SUPERADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE";
export type WorkMode = "OFFICE" | "FIELD" | "BOTH";
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE";
export type ExpenseCategory = "TRAVEL" | "FOOD" | "ACCOMMODATION" | "OTHER";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  workMode: WorkMode;
  designation?: string | null;
  joiningDate: string;
  avatarUrl?: string;
  shiftStart: string;
  shiftEnd: string;
  companyId: string;
  managerId?: string | null;
  groupId?: string | null;
  baseSalary: number;
  createdAt: string;
}

export interface UserListResponse {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedToId: string;
  assignedById: string;
  dueDate: string;
  lat?: number | null;
  lng?: number | null;
  priority: string;
  points: number;
  createdAt: string;
  updatedAt: string;
  isRepeating: boolean;
  repeatFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  completionPhotoUrl?: string | null;
  completionRemarks?: string | null;
  assignedTo: User;
  assignedBy: User;
}

export interface Break {
  id: string;
  attendanceId: string;
  startTime: string;
  endTime?: string | null;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  punchType?: "OFFICE" | "FIELD" | null;
  checkInTime?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInPhotoUrl?: string | null;
  checkOutTime?: string | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkOutPhotoUrl?: string | null;
  status: AttendanceStatus;
  breaks?: Break[];
}

export interface DayEndReport {
  id: string;
  userId: string;
  date: string;
  visitsSummary: string;
  ordersTaken: number;
  ordersCancelled: number;
  kmTravelled: number;
  startOdometer?: number | null;
  endOdometer?: number | null;
  startOdometerPhotoUrl?: string | null;
  kmPhotoUrl?: string | null;
  remarks: string;
  submittedAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  receiptUrl: string;
  date: string;
  approved: boolean;
  approvedById?: string | null;
  createdAt: string;
  updatedAt: string;
  user: User;
}

export interface LocationLog {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  batteryLevel?: number | null;
  timestamp: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface DashboardStats {
  totalEmployees: number;
  checkedInToday: number;
  pendingTasks: number;
  pendingExpenses: number;
}
