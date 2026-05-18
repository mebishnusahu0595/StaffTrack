export const ACCESS_COOKIE = "stafftrack_access_token";
export const REFRESH_COOKIE = "stafftrack_refresh_token";
export const USER_COOKIE = "stafftrack_user";

export const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const;
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_TARGET ?? process.env.API_BASE_URL ?? "http://localhost:4000";
