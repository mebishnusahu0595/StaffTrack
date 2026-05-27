export const ACCESS_COOKIE = "stafftrack_access_token";
export const REFRESH_COOKIE = "stafftrack_refresh_token";
export const USER_COOKIE = "stafftrack_user";

export const ALLOWED_ROLES = ["SUPERADMIN", "ADMIN"] as const;
export const BACKEND_URL = normalizeBackendUrl(
  process.env.NEXT_PUBLIC_API_TARGET ?? process.env.API_BASE_URL ?? "https://stafftrack.cloud"
);

function normalizeBackendUrl(url: string) {
  return url.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}
