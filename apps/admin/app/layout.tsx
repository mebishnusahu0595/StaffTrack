import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppProviders } from "@/components/app-providers";
import { getSessionUserFromToken, parseUserCookie } from "@/lib/auth";
import { ACCESS_COOKIE, USER_COOKIE } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: "StaffTrack Admin",
  description: "Admin operations console for StaffTrack"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const user =
    parseUserCookie(cookieStore.get(USER_COOKIE)?.value) ??
    getSessionUserFromToken(cookieStore.get(ACCESS_COOKIE)?.value);

  return (
    <html lang="en">
      <body>
        <AppProviders initialUser={user}>{children}</AppProviders>
      </body>
    </html>
  );
}
