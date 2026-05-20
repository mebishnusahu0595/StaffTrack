import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StaffTrack SuperAdmin Dashboard",
  description: "Global system management and overrides",
  icons: {
    icon: "/superadmin-favicon.png"
  }
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
