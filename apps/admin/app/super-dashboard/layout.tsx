import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StaffTrack SuperAdmin",
  description: "Global system management and overrides"
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
