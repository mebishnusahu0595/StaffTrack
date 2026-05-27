import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { getSessionUserFromToken, parseUserCookie } from "@/lib/auth";
import { ACCESS_COOKIE, USER_COOKIE } from "@/lib/constants";
import { cookies } from "next/headers";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const user =
    parseUserCookie(cookieStore.get(USER_COOKIE)?.value) ?? getSessionUserFromToken(accessToken);
  const hasAccessToken = Boolean(accessToken);

  if (!hasAccessToken || !user || !["SUPERADMIN", "ADMIN", "MANAGER", "EMPLOYEE"].includes(user.role)) {
    redirect("/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
