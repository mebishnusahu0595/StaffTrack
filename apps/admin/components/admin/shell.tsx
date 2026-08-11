"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Bell,
  Bot,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Plus,
  Receipt,
  Search,
  Settings,
  Users,
  UserCheck,
  User,
  Zap,
  Folder,
  AlertTriangle,
  FileSpreadsheet,
  Library,
  ChevronDown,
  ChevronUp,
  Wallet,
  Calendar,
  CalendarDays,
  Menu,
  X,
  Send,
  Fingerprint,
  CheckSquare,
  Battery,
  Clock,
  UploadCloud,
  Store,
  Image as ImageIcon
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import {
  fetchPendingLateCheckIns,
  fetchAttendanceRequests,
  fetchLeaves,
  fetchExpenses,
  fetchAllAttendance,
  fetchUsers,
  fetchIssues
} from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type Role = "SUPERADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE";

// `roles` omitted means "visible to everyone who can reach the dashboard".
const navItems: { href: string; label: string; icon: any; roles?: Role[] }[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot, roles: ["ADMIN", "SUPERADMIN"] },
  { href: "/team", label: "Team Overview", icon: UserCheck },
  { href: "/projects", label: "Project", icon: Folder },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/dealers", label: "Dealers", icon: Store },
  { href: "/issues", label: "Issues", icon: AlertTriangle },
  { href: "/forms", label: "Forms", icon: FileSpreadsheet },
  { href: "/company-files", label: "Uploads", icon: UploadCloud },
  { href: "/gallery", label: "Media Gallery", icon: ImageIcon, roles: ["SUPERADMIN", "ADMIN"] },
  { href: "/broadcast", label: "Broadcast", icon: Send, roles: ["SUPERADMIN", "ADMIN", "MANAGER"] },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/leaves", label: "Leaves", icon: Calendar },
  { href: "/holidays", label: "Holidays", icon: CalendarDays },
  { href: "/templates", label: "Template Library", icon: Library },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/reports/muster", label: "Muster Report", icon: FileSpreadsheet },
  { href: "/attendance", label: "Attendance Log", icon: Clock },
  { href: "/employees", label: "User Management", icon: Users },
  { href: "/groups", label: "Departments", icon: Users },
  { href: "/payroll", label: "Payroll Console", icon: Zap },
  { href: "/salary", label: "Salary Matrix", icon: Wallet },
  { href: "/payroll/attendance-dashboard", label: "Attendance Dashboard", icon: Fingerprint },
  { href: "/payroll/approval-requests", label: "Approval Requests", icon: CheckSquare },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");

  type LocationOffAlert = {
    userId: string;
    name: string;
    batteryLevel: number | null;
    timestamp: string;
  };
  const [alerts, setAlerts] = useState<LocationOffAlert[]>([]);
  const navRef = useRef<HTMLDivElement>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight > el.clientHeight;
    setShowScrollUp(canScroll && el.scrollTop > 10);
    setShowScrollDown(canScroll && el.scrollTop + el.clientHeight < el.scrollHeight - 10);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    checkScroll();
    window.addEventListener("resize", checkScroll);
    const timer = setTimeout(checkScroll, 1000);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      clearTimeout(timer);
    };
  }, [checkScroll]);

  const scrollNav = (direction: "up" | "down") => {
    const el = navRef.current;
    if (!el) return;
    const amount = direction === "up" ? -150 : 150;
    el.scrollBy({ top: amount, behavior: "smooth" });
  };

  // Keyboard listener: ESC to go back, ENTER on inputs to submit
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const hasOpenModal = document.querySelector('[role="dialog"], [aria-modal="true"]');
        if (!hasOpenModal) {
          window.history.back();
        }
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement;
        if (target && target.tagName === "INPUT" && (target as HTMLInputElement).type !== "button" && (target as HTMLInputElement).type !== "submit") {
          const parentForm = target.closest("form");
          if (parentForm) {
            return;
          }
          const container = target.closest('[role="dialog"], .dialog, .card, [class*="DialogContent"], [class*="SheetContent"]');
          if (container) {
            const buttons = Array.from(container.querySelectorAll("button"));
            const submitBtn = buttons.find(btn => {
              const text = btn.innerText?.toLowerCase() || "";
              return btn.getAttribute("type") === "submit" || 
                     text.includes("save") || 
                     text.includes("submit") || 
                     text.includes("create") || 
                     text.includes("update") || 
                     text.includes("add");
            });
            if (submitBtn) {
              e.preventDefault();
              submitBtn.click();
            }
          }
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleAlert = (e: Event) => {
      const customEvent = e as CustomEvent<LocationOffAlert>;
      setAlerts((prev) => {
        if (prev.some((a) => a.userId === customEvent.detail.userId)) {
          return prev;
        }
        return [...prev, customEvent.detail];
      });
    };

    window.addEventListener("location-off-alert", handleAlert);
    return () => {
      window.removeEventListener("location-off-alert", handleAlert);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Live "needs attention" counts for sidebar badges. Polled lightly so a new
  // request shows up within ~45s without a manual refresh.
  const enabledBadges = Boolean(user);
  const { data: lateCheckIns = [] } = useQuery({
    queryKey: ["pendingLateCheckIns"],
    queryFn: fetchPendingLateCheckIns,
    enabled: enabledBadges,
    refetchInterval: 45_000
  });
  const { data: pendingAdjustments = [] } = useQuery({
    queryKey: ["attendanceRequests", "PENDING"],
    queryFn: () => fetchAttendanceRequests("PENDING"),
    enabled: enabledBadges,
    refetchInterval: 45_000
  });
  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ["leaves", "PENDING"],
    queryFn: () => fetchLeaves({ status: "PENDING" }),
    enabled: enabledBadges,
    refetchInterval: 45_000
  });
  const { data: allExpenses = [] } = useQuery({
    queryKey: ["expenses", "sidebar"],
    queryFn: () => fetchExpenses(),
    enabled: enabledBadges,
    refetchInterval: 60_000
  });

  const { data: allIssues = [] } = useQuery({
    queryKey: ["issues", "sidebar"],
    queryFn: () => fetchIssues(),
    enabled: enabledBadges,
    refetchInterval: 60_000
  });
 
  const pendingExpenses = (allExpenses as any[]).filter((e) => !e.approved && !e.approvedById).length;
  const pendingIssues = (allIssues as any[]).filter((i) => i.status === "Open" || i.status === "In Progress").length;
  const badgeCounts: Record<string, number> = {
    "/payroll/approval-requests": (lateCheckIns as any[]).length + (pendingAdjustments as any[]).length,
    "/leaves": (pendingLeaves as any[]).length,
    "/expenses": pendingExpenses,
    "/issues": pendingIssues
  };

  // Live Location Warnings and Today's Attendance Query
  const todayDate = dayjs().format("YYYY-MM-DD");
  const [readWarningIds, setReadWarningIds] = useState<Set<string>>(new Set());
  const [notifDateFilter, setNotifDateFilter] = useState(todayDate);

  const todayAttendanceQuery = useQuery({
    queryKey: ["attendance", "overview", notifDateFilter],
    queryFn: () => fetchAllAttendance(notifDateFilter),
    enabled: enabledBadges,
    refetchInterval: 15_000
  });

  const usersQuery = useQuery({
    queryKey: ["users", "all-list"],
    queryFn: () => fetchUsers({ page: 1, pageSize: 100 }),
    enabled: enabledBadges,
    refetchInterval: 15_000
  });

  const locationWarnings = useMemo(() => {
    if (!usersQuery.data?.items || !todayAttendanceQuery.data) return [];

    // Only care about users who are ACTIVELY punched in (checkIn but no checkOut)
    const activeAttendanceMap = new Map();
    for (const record of todayAttendanceQuery.data) {
      if (record.checkInTime && !record.checkOutTime) {
        const existing = activeAttendanceMap.get(record.userId);
        if (!existing || new Date(record.checkInTime) > new Date(existing.checkInTime)) {
          activeAttendanceMap.set(record.userId, record);
        }
      }
    }

    const warnings: {
      userId: string;
      name: string;
      role: string;
      batteryLevel: number | null;
      isLocationOn: boolean;
      isFieldPunched: boolean;
      punchType: string;
      type: "FIELD_PUNCH_LOCATION_OFF" | "ACTIVE_PUNCH_LOCATION_OFF";
      message: string;
      timestamp: string;
    }[] = [];

    for (const u of usersQuery.data.items) {
      if (u.role !== "EMPLOYEE" && u.role !== "MANAGER") continue;

      const activePunch = activeAttendanceMap.get(u.id);
      // ONLY warn if user is actively punched in right now
      if (!activePunch) continue;

      const isLocationOn = Boolean(u.isLocationOn);
      if (isLocationOn) continue; // location is on, no warning needed

      const isFieldPunched = activePunch.punchType === "FIELD";
      const punchType = activePunch.punchType ?? "OFFICE";

      warnings.push({
        userId: u.id,
        name: u.name,
        role: u.role,
        batteryLevel: u.batteryLevel ?? null,
        isLocationOn,
        isFieldPunched,
        punchType,
        type: isFieldPunched ? "FIELD_PUNCH_LOCATION_OFF" : "ACTIVE_PUNCH_LOCATION_OFF",
        message: isFieldPunched
          ? `${u.name} checked in to FIELD but location is OFF.`
          : `${u.name} is punched in (${punchType}) but location is OFF.`,
        timestamp: u.locationOffAt ? u.locationOffAt.toString() : (activePunch.checkInTime || new Date().toISOString())
      });
    }

    // Sort: FIELD warnings first, then by name
    return warnings.sort((a, b) => {
      if (a.type === "FIELD_PUNCH_LOCATION_OFF" && b.type !== "FIELD_PUNCH_LOCATION_OFF") return -1;
      if (b.type === "FIELD_PUNCH_LOCATION_OFF" && a.type !== "FIELD_PUNCH_LOCATION_OFF") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [usersQuery.data?.items, todayAttendanceQuery.data]);

  const unreadWarnings = useMemo(() =>
    locationWarnings.filter(w => !readWarningIds.has(w.userId)),
    [locationWarnings, readWarningIds]
  );

  const markAllRead = useCallback(() => {
    setReadWarningIds(new Set(locationWarnings.map(w => w.userId)));
  }, [locationWarnings]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop & Mobile Drawer */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 flex-col bg-[#0F172A] text-slate-100 transition-transform duration-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="px-8 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-md overflow-hidden p-1">
              <img src="/logo.png" alt="StaffTrack" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">StaffTrack</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col relative overflow-hidden">
          {showScrollUp && (
            <button
              onClick={() => scrollNav("up")}
              className="absolute top-1 left-1/2 -translate-x-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 hover:bg-slate-700/90 shadow-md hover:scale-105 active:scale-95 transition-all animate-bounce"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}

          <nav ref={navRef} className="flex-1 space-y-1 px-4 overflow-y-auto custom-scrollbar scroll-smooth">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search menu..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs font-medium text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              />
            </div>
            {navItems
              .filter((item) => !item.roles || (user?.role && item.roles.includes(user.role as Role)))
              .filter((item) => !sidebarSearch || item.label.toLowerCase().includes(sidebarSearch.toLowerCase()))
              .map((item) => {
              const isActive = pathname === item.href;
              const badge = badgeCounts[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold",
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span className={cn(
                      "ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-black",
                      isActive ? "bg-white text-blue-600" : "bg-rose-500 text-white"
                    )}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {showScrollDown && (
            <button
              onClick={() => scrollNav("down")}
              className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 hover:bg-slate-700/90 shadow-md hover:scale-105 active:scale-95 transition-all animate-bounce"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="p-4 border-t border-slate-800/50">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
            onClick={() => signOut()}
          >
            <LogOut className="h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/80 px-4 md:px-8 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-4 md:gap-6">
            {/* Mobile Menu Trigger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10 text-slate-500"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <LayoutDashboard className="h-6 w-6" />
            </Button>
            {/* Clock Widget */}
            <div className="hidden md:flex items-center gap-4 px-5 py-2.5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm font-black text-slate-700 tracking-tight tabular-nums">
                  {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:-- --'}
                </span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                {currentTime ? currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '---'}
              </span>
            </div>

            <div className="relative group hidden lg:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder="Search everything..."
                className="w-72 rounded-xl border-slate-200 bg-slate-100/50 pl-11 h-11 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 h-10 font-bold shadow-lg shadow-blue-100 gap-2">
                  <Plus className="h-4 w-4" />
                  Create
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-2xl shadow-xl border-slate-100 p-2">
                <DropdownMenuItem asChild className="gap-3 py-2.5 rounded-xl font-bold text-slate-600 focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                  <Link href="/tasks" className="flex items-center gap-3 w-full">
                    <ClipboardList className="h-4 w-4" /> Task
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-3 py-2.5 rounded-xl font-bold text-slate-600 focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                  <Link href="/issues" className="flex items-center gap-3 w-full">
                    <AlertTriangle className="h-4 w-4" /> Issue
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-3 py-2.5 rounded-xl font-bold text-slate-600 focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                  <Link href="/forms" className="flex items-center gap-3 w-full">
                    <FileSpreadsheet className="h-4 w-4" /> Form
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-3 py-2.5 rounded-xl font-bold text-slate-600 focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                  <Link href="/projects" className="flex items-center gap-3 w-full">
                    <Folder className="h-4 w-4" /> Project
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-3 py-2.5 rounded-xl font-bold text-slate-600 focus:bg-blue-50 focus:text-blue-600 cursor-pointer">
                  <Link href="/company-files" className="flex items-center gap-3 w-full">
                    <UploadCloud className="h-4 w-4" /> Upload File
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-1.5 border-r border-slate-100 pr-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:bg-slate-50 rounded-xl relative">
                    <Bell className="h-5 w-5" />
                    {unreadWarnings.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white ring-2 ring-white">
                        {unreadWarnings.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[340px] rounded-2xl shadow-xl border border-slate-200 p-0 z-50" style={{ maxHeight: "480px", display: "flex", flexDirection: "column" }}>
                  {/* Header */}
                  <div className="px-4 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Location Alerts</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full",
                        locationWarnings.length > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-400"
                      )}>{locationWarnings.length} Active</span>
                      {locationWarnings.length > 0 && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAllRead(); }}
                          className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Date filter */}
                  <div className="px-4 py-2 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <input
                        type="date"
                        value={notifDateFilter}
                        max={todayDate}
                        onChange={(e) => { setNotifDateFilter(e.target.value); setReadWarningIds(new Set()); }}
                        className="flex-1 text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      {notifDateFilter !== todayDate && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNotifDateFilter(todayDate); setReadWarningIds(new Set()); }}
                          className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase"
                        >
                          Today
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Warnings list */}
                  <div className="overflow-y-auto flex-1 p-2">
                    {locationWarnings.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-400">
                        <CheckSquare className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                        <p className="font-bold">All clear!</p>
                        <p className="mt-1">No active punched-in users with location off{notifDateFilter !== todayDate ? ` on ${dayjs(notifDateFilter).format("DD MMM")}` : " today"}.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 mt-1">
                        {locationWarnings.map((warning) => {
                          const isRead = readWarningIds.has(warning.userId);
                          return (
                            <DropdownMenuItem
                              key={warning.userId}
                              className={cn(
                                "flex flex-col items-start gap-1 p-3 rounded-xl border transition-all cursor-pointer text-left focus:outline-none",
                                isRead && "opacity-50",
                                warning.type === "FIELD_PUNCH_LOCATION_OFF"
                                  ? "bg-rose-50/60 border-rose-100 hover:bg-rose-50"
                                  : "bg-amber-50/40 border-amber-100/60 hover:bg-amber-50/60"
                              )}
                              onSelect={() => {
                                setReadWarningIds(prev => new Set([...prev, warning.userId]));
                                window.location.href = `/employees?search=${encodeURIComponent(warning.name)}`;
                              }}
                            >
                              <div className="flex items-center gap-2 w-full justify-between">
                                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  {warning.type === "FIELD_PUNCH_LOCATION_OFF" ? (
                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 animate-pulse shrink-0" />
                                  ) : (
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                  )}
                                  {warning.name}
                                  {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />}
                                </span>
                                <span className="text-[9px] font-black uppercase text-slate-500 bg-white border border-slate-200/60 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm shrink-0">
                                  <Battery className="h-2.5 w-2.5 text-slate-500" />
                                  {warning.batteryLevel != null ? `${warning.batteryLevel}%` : "N/A"}
                                </span>
                              </div>
                              <p className="text-[11px] font-semibold leading-relaxed text-slate-600">
                                {warning.message}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-wider",
                                  warning.type === "FIELD_PUNCH_LOCATION_OFF" ? "text-rose-500" : "text-amber-600"
                                )}>
                                  {warning.punchType} ACTIVE • LOCATION OFF
                                </span>
                                <span className="text-[9px] font-bold text-slate-400">
                                  Since {dayjs(warning.timestamp).format("hh:mm A, DD MMM")}
                                </span>
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link href="/settings" passHref legacyBehavior>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:bg-slate-50 rounded-xl">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 leading-tight">{user?.name || "Admin"}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Super Admin</p>
              </div>
              <Link href="/profile">
                <Avatar className="h-11 w-11 border-2 border-white shadow-md ring-1 ring-slate-100 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Admin" className="h-full w-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-slate-100 text-slate-400">
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  )}
                </Avatar>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Floating Location Alerts */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full">
        {alerts.map((alert) => (
          <div
            key={alert.userId}
            className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white/95 p-5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-300 ring-1 ring-rose-500/10"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                  <AlertTriangle className="h-5 w-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 leading-tight">Location Off Alert</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Alert Notification</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 -mt-1 -mr-1"
                onClick={() => setAlerts((prev) => prev.filter((a) => a.userId !== alert.userId))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500">Employee:</span>
                <span className="font-black text-slate-900">{alert.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500">Battery Health:</span>
                <span className={cn(
                  "font-black px-2 py-0.5 rounded-full text-[10px]",
                  alert.batteryLevel !== null && alert.batteryLevel <= 20 
                    ? "bg-rose-50 text-rose-600"
                    : "bg-slate-50 text-slate-700"
                )}>
                  {alert.batteryLevel !== null ? `${alert.batteryLevel}%` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500">Time:</span>
                <span className="font-medium text-slate-600">
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-1">
              <Button
                size="sm"
                variant="destructive"
                className="w-full rounded-xl font-bold text-xs"
                onClick={() => setAlerts((prev) => prev.filter((a) => a.userId !== alert.userId))}
              >
                Acknowledge
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
