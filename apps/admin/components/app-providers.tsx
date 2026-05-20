import { AuthProvider } from "@/components/auth-provider";
import { QueryProvider } from "@/components/query-provider";
import { SocketInitializer } from "@/components/socket-initializer";
import { NavProgress } from "@/components/nav-progress";
import type { User } from "@/lib/types";

export function AppProviders({
  children,
  initialUser
}: {
  children: React.ReactNode;
  initialUser: User | null;
}) {
  return (
    <QueryProvider>
      <AuthProvider initialUser={initialUser}>
        <NavProgress />
        <SocketInitializer />
        {children}
      </AuthProvider>
    </QueryProvider>
  );
}
