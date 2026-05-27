export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  EMPLOYEE = "EMPLOYEE"
}

export enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum ExpenseCategory {
  TRAVEL = "TRAVEL",
  FOOD = "FOOD",
  ACCOMMODATION = "ACCOMMODATION",
  OTHER = "OTHER"
}

export enum AttendanceStatus {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
  HALF_DAY = "HALF_DAY",
  ON_LEAVE = "ON_LEAVE"
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  companyId: string;
  managerId?: string;
  createdAt: Date;
}

export interface Company {
  id: string;
  name: string;
  adminId: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  status: TaskStatus;
  dueDate: Date;
  location?: LatLng;
  createdAt: Date;
}

export interface LocationLog {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: Date;
  batteryLevel?: number;
}

export interface DayEndReport {
  id: string;
  userId: string;
  date: Date;
  visitsSummary: string;
  ordersTaken: number;
  ordersCancelled: number;
  totalKmTravelled: number;
  remarks: string;
  submittedAt: Date;
}

export interface Expense {
  id: string;
  userId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  receiptUrl: string;
  date: Date;
  approved?: boolean;
  approvedBy?: string;
}

export interface Attendance {
  id: string;
  userId: string;
  date: Date;
  punchType?: "OFFICE" | "FIELD" | null;
  checkInTime?: Date | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInPhotoUrl?: string | null;
  startOdometerPhotoUrl?: string | null;
  checkOutTime?: Date | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkOutPhotoUrl?: string | null;
  endOdometerPhotoUrl?: string | null;
  status: AttendanceStatus;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
