import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StaffTrack SuperAdmin Login",
  description: "Secure authorization for global operations",
  icons: {
    icon: "/superadmin-favicon.png"
  }
};

export default function SuperAdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
