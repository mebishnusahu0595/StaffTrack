import { ACCESS_COOKIE, ALLOWED_ROLES, USER_COOKIE } from "@/lib/constants";
import type { User } from "@/lib/types";

export function parseUserCookie(cookieValue?: string): User | null {
  if (!cookieValue) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(cookieValue);
    return JSON.parse(decoded) as User;
  } catch {
    return null;
  }
}

export function canAccessDashboard(user: User | null) {
  return Boolean(
    user && ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])
  );
}

function normalizeJwtBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  return padding === 0 ? normalized : normalized.padEnd(normalized.length + (4 - padding), "=");
}

export function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    const normalized = normalizeJwtBase64(payload);
    const json =
      typeof window === "undefined"
        ? Buffer.from(normalized, "base64").toString("utf8")
        : atob(normalized);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function hasAccessTokenCookie(cookieHeader: string | null) {
  return Boolean(cookieHeader?.includes(`${ACCESS_COOKIE}=`));
}

export function getStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";").map((c) => c.trim());
  const userCookie = cookies.find((c) => c.startsWith(`${USER_COOKIE}=`));
  const cookieValue = userCookie?.substring(USER_COOKIE.length + 1);

  return parseUserCookie(cookieValue);
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";").map((c) => c.trim());
  const tokenCookie = cookies.find((c) => c.startsWith(`${ACCESS_COOKIE}=`));
  return tokenCookie?.substring(ACCESS_COOKIE.length + 1) || null;
}

export function getSessionUserFromToken(token?: string | null): User | null {
  if (!token) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  const subject = payload?.sub;

  if (
    typeof subject !== "string" ||
    typeof role !== "string" ||
    !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])
  ) {
    return null;
  }

  return {
    id: subject,
    name: "Admin",
    email: "",
    phone: "",
    role: role as User["role"],
    workMode: "OFFICE",
    companyId: typeof payload?.companyId === "string" ? payload.companyId : "",
    managerId: typeof payload?.managerId === "string" ? payload.managerId : null,
    shiftStart: "",
    shiftEnd: "",
    createdAt: "",
    joiningDate: "",
    baseSalary: 0
  };
}
