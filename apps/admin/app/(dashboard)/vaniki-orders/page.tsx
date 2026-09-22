"use client";

import React, { useState, useMemo } from "react";
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Clock,
  Calendar,
  User,
  Store,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Phone,
  MapPin,
  Building2,
  Package,
  Receipt,
  Printer,
  ChevronRight,
  ExternalLink,
  Eye,
  SlidersHorizontal,
  X,
  TrendingUp,
  DollarSign,
  Activity,
  Layers,
  ArrowUpRight,
  Sparkles,
  Pause,
  Play
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchVanikiActivities,
  type VanikiActivity,
  type VanikiActivitiesResponse
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function formatISTDateTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return dateStr;
  }
}

function getRelativeTimeString(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}

export default function VanikiOrdersMonitoringPage() {
  // ─── Filter & Search State ────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | "ORDER_PLACED" | "DEALER_LOOKUP">("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "WEEK">("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<"FEED" | "TABLE">("FEED");

  // ─── Modal State ──────────────────────────────────────────────────────────
  const [selectedActivity, setSelectedActivity] = useState<VanikiActivity | null>(null);

  // ─── Query ────────────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<VanikiActivitiesResponse>({
    queryKey: ["vanikiActivities", actionFilter],
    queryFn: () =>
      fetchVanikiActivities({
        action: actionFilter === "ALL" ? undefined : actionFilter,
        limit: 100,
      }),
    refetchInterval: autoRefresh ? 15000 : false, // Auto-refresh every 15s
  });

  const activities = data?.activities || [];
  const stats = data?.stats || {
    totalOrders: 0,
    totalOrderValue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    totalLookups: 0,
    activeStaffCount: 0,
    todayActivitiesCount: 0,
  };

  // ─── Filtered Activities ──────────────────────────────────────────────────
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Date filter
      if (dateFilter === "TODAY") {
        const actDate = new Date(act.createdAt).toDateString();
        const todayDate = new Date().toDateString();
        if (actDate !== todayDate) return false;
      } else if (dateFilter === "WEEK") {
        const diffDays = (Date.now() - new Date(act.createdAt).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      }

      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const staff = (act.staffName || "").toLowerCase();
      const dealer = (act.dealerName || "").toLowerCase();
      const store = (act.storeName || "").toLowerCase();
      const fourDigit = (act.fourDigitId || "").toLowerCase();
      const code = (act.dealerCode || "").toLowerCase();
      const inv = (act.invoiceNumber || "").toLowerCase();
      const city = (act.dealerCity || "").toLowerCase();
      const notes = (act.notes || "").toLowerCase();

      return (
        staff.includes(term) ||
        dealer.includes(term) ||
        store.includes(term) ||
        fourDigit.includes(term) ||
        code.includes(term) ||
        inv.includes(term) ||
        city.includes(term) ||
        notes.includes(term)
      );
    });
  }, [activities, searchTerm, dateFilter]);

  // Extract items from metadata if present
  const modalItems = useMemo(() => {
    if (!selectedActivity?.metadata?.items) return [];
    return Array.isArray(selectedActivity.metadata.items) ? selectedActivity.metadata.items : [];
  }, [selectedActivity]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      {/* ─── Top Header with Live Indicator ────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  Vaniki Dealer Orders & Activities
                </h1>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>LIVE MONITORING</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Field staff dealer visits, 4-digit code lookups aur wholesale orders ka real-time timeline.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs gap-1.5 h-9 ${
              autoRefresh
                ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10"
                : "text-muted-foreground"
            }`}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>Auto-Refresh (15s): {autoRefresh ? "ON" : "PAUSED"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs gap-1.5 h-9 bg-card hover:bg-muted font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-emerald-600" : ""}`} />
            <span>Refresh</span>
          </Button>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5">
            <button
              onClick={() => setViewMode("FEED")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                viewMode === "FEED" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Timeline Feed
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                viewMode === "TABLE" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Table View
            </button>
          </div>
        </div>
      </div>

      {/* ─── Top KPI Stat Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {/* Stat 1: Total Orders */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-emerald-500/40 transition">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Orders</span>
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-foreground font-mono">
              {stats.totalOrders}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              ₹{stats.totalOrderValue.toLocaleString("en-IN")} total value
            </p>
          </CardContent>
        </Card>

        {/* Stat 2: Total Paid Collected */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-emerald-500/40 transition">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Paid Amount</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              ₹{stats.totalPaid.toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Cash / UPI / Transfer
            </p>
          </CardContent>
        </Card>

        {/* Stat 3: Total Outstanding Udhaar */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-rose-500/40 transition">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Balance Udhaar</span>
              <CreditCard className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">
              ₹{stats.totalOutstanding.toLocaleString("en-IN")}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Pending collection
            </p>
          </CardContent>
        </Card>

        {/* Stat 4: Dealer Lookups */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-blue-500/40 transition">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Code Lookups</span>
              <Store className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
              {stats.totalLookups}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Dealer shop checks
            </p>
          </CardContent>
        </Card>

        {/* Stat 5: Active Staff */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-amber-500/40 transition">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Field Staff</span>
              <User className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-foreground font-mono">
              {stats.activeStaffCount}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Active staff members
            </p>
          </CardContent>
        </Card>

        {/* Stat 6: Today's Activities */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:border-purple-500/40 transition">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Today</span>
              <Activity className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono">
              {stats.todayActivitiesCount}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Actions taken today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search & Filters Card ─────────────────────────────────────────── */}
      <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search staff, dealer, #1018, store, invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm bg-background/80"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action Type Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              <Button
                variant={actionFilter === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setActionFilter("ALL")}
                className={`h-9 text-xs font-medium rounded-lg ${
                  actionFilter === "ALL" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                }`}
              >
                All Activities ({activities.length})
              </Button>
              <Button
                variant={actionFilter === "ORDER_PLACED" ? "default" : "outline"}
                size="sm"
                onClick={() => setActionFilter("ORDER_PLACED")}
                className={`h-9 text-xs font-medium rounded-lg ${
                  actionFilter === "ORDER_PLACED" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                }`}
              >
                Wholesale Orders ({stats.totalOrders})
              </Button>
              <Button
                variant={actionFilter === "DEALER_LOOKUP" ? "default" : "outline"}
                size="sm"
                onClick={() => setActionFilter("DEALER_LOOKUP")}
                className={`h-9 text-xs font-medium rounded-lg ${
                  actionFilter === "DEALER_LOOKUP" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                }`}
              >
                Dealer Lookups ({stats.totalLookups})
              </Button>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground mr-1 hidden sm:inline">Date:</span>
              <button
                onClick={() => setDateFilter("ALL")}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  dateFilter === "ALL"
                    ? "bg-secondary text-secondary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setDateFilter("TODAY")}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  dateFilter === "TODAY"
                    ? "bg-secondary text-secondary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter("WEEK")}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  dateFilter === "WEEK"
                    ? "bg-secondary text-secondary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Last 7 Days
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Activities Display: Timeline Feed or Table ───────────────────────── */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm font-medium">Loading live staff activities & orders...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <Card className="border-dashed border-border/80 p-12 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">No Activities Recorded Yet</h3>
            <p className="text-sm text-muted-foreground">
              Jaise hi koi field staff mobile app se kisi dealer ka code enter karega ya wholesale order lega, yahan exact time & details ke saath real-time dikhega!
            </p>
          </div>
        </Card>
      ) : viewMode === "FEED" ? (
        /* ─── Timeline Feed View ────────────────────────────────────────────── */
        <div className="space-y-4">
          {filteredActivities.map((act) => {
            const isOrder = act.action === "ORDER_PLACED";
            const relativeTime = getRelativeTimeString(act.createdAt);
            const fullTime = formatISTDateTime(act.createdAt);

            return (
              <Card
                key={act.id}
                className={`border transition-all duration-200 overflow-hidden ${
                  isOrder
                    ? "border-emerald-500/30 hover:border-emerald-500/60 bg-gradient-to-r from-emerald-500/[0.03] via-card to-card"
                    : "border-blue-500/30 hover:border-blue-500/60 bg-gradient-to-r from-blue-500/[0.03] via-card to-card"
                }`}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Action Pill + Staff + Dealer Info */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      {/* Top Header Row: Timestamp + Action Badge */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {isOrder ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-2.5 py-0.5 flex items-center gap-1.5 shadow-sm">
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Wholesale Order Placed</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-2.5 py-0.5 flex items-center gap-1.5 shadow-sm">
                            <Store className="w-3.5 h-3.5" />
                            <span>Dealer Code Entered / Visit</span>
                          </Badge>
                        )}

                        {/* Invoice Number if order */}
                        {act.invoiceNumber && (
                          <Badge variant="outline" className="font-mono text-xs font-semibold">
                            #{act.invoiceNumber}
                          </Badge>
                        )}

                        {/* Timestamp with IST and Relative */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto lg:ml-0">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-medium text-foreground">{fullTime}</span>
                          <span className="text-[11px] text-muted-foreground">({relativeTime})</span>
                        </div>
                      </div>

                      {/* Main Details Grid: Staff + Dealer */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Staff Details Card */}
                        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border/40">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {act.staffName ? act.staffName.charAt(0).toUpperCase() : "S"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                              Field Staff Member
                            </div>
                            <div className="text-sm font-bold text-foreground truncate">
                              {act.staffName}
                            </div>
                            {act.staffPhone && (
                              <a
                                href={`tel:${act.staffPhone}`}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono mt-0.5"
                              >
                                <Phone className="w-3 h-3 text-emerald-500" />
                                <span>{act.staffPhone}</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Dealer Details Card */}
                        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border/40">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            <Store className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                Dealer
                              </span>
                              {act.fourDigitId && (
                                <Badge className="bg-emerald-600/90 text-white font-mono text-[10px] py-0 px-1.5 h-4">
                                  #{act.fourDigitId}
                                </Badge>
                              )}
                              {act.dealerCode && (
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  ({act.dealerCode})
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-bold text-foreground truncate">
                              {act.dealerName}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
                              {act.storeName && (
                                <span className="font-medium text-foreground">{act.storeName}</span>
                              )}
                              {act.dealerCity && (
                                <span className="flex items-center gap-0.5 text-muted-foreground">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {act.dealerCity}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Notes / Deal Remarks Preview */}
                      {act.notes && (
                        <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-2 border border-border/30 flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{act.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Financial Highlights & Action Button */}
                    <div className="lg:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-border/60 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between space-y-3">
                      {isOrder ? (
                        <div className="space-y-2">
                          {/* Financials Row */}
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-muted-foreground">Order Value:</span>
                            <span className="text-lg font-bold font-mono text-foreground">
                              ₹{act.totalAmount.toLocaleString("en-IN")}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                                Paid Amount
                              </span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                ₹{act.paidAmount.toLocaleString("en-IN")}
                              </span>
                            </div>

                            <div className={`p-2 rounded-md border ${
                              act.outstandingAmount > 0
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                                : "bg-muted/60 border-border/40 text-muted-foreground"
                            }`}>
                              <span className="text-[10px] font-semibold block">
                                Balance Udhaar
                              </span>
                              <span className="font-mono font-bold">
                                ₹{act.outstandingAmount.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                            <span>
                              Items: <strong>{act.petis} Petis</strong> ({act.itemsCount} prods)
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 uppercase">
                              {act.paymentMode || "CREDIT"}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground">
                            Dealer Financial Health at Visit:
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 bg-secondary/60 rounded-md border border-border/40">
                              <span className="text-[10px] font-semibold text-muted-foreground block">
                                Credit Limit
                              </span>
                              <span className="font-mono font-bold text-foreground">
                                ₹{act.totalAmount.toLocaleString("en-IN")}
                              </span>
                            </div>

                            <div className={`p-2 rounded-md border ${
                              act.outstandingAmount > 0
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                            }`}>
                              <span className="text-[10px] font-semibold block">
                                Current Udhaar
                              </span>
                              <span className="font-mono font-bold">
                                ₹{act.outstandingAmount.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-muted-foreground">
                            Unpaid Invoices: <strong>{act.metadata?.unpaidInvoices || 0}</strong>
                          </div>
                        </div>
                      )}

                      {/* View Details Button */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedActivity(act)}
                        className="w-full text-xs font-semibold h-8 flex items-center justify-center gap-1.5 hover:bg-primary hover:text-primary-foreground transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isOrder ? "View Order Details" : "View Dealer Details"}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ─── Tabular Data View ─────────────────────────────────────────────── */
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/80 text-muted-foreground font-semibold uppercase tracking-wider text-[10px] border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Dealer (#ID / Store)</th>
                  <th className="py-3 px-4 text-right">Order Value</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Udhaar</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredActivities.map((act) => {
                  const isOrder = act.action === "ORDER_PLACED";
                  return (
                    <tr key={act.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-foreground">{formatISTDateTime(act.createdAt)}</div>
                        <div className="text-[11px] text-muted-foreground">{getRelativeTimeString(act.createdAt)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{act.staffName}</div>
                        {act.staffPhone && (
                          <div className="text-[11px] text-muted-foreground font-mono">{act.staffPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isOrder ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                            Wholesale Order
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px]">
                            Dealer Visit / Lookup
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {act.fourDigitId && (
                            <Badge variant="outline" className="font-mono text-[10px] py-0">
                              #{act.fourDigitId}
                            </Badge>
                          )}
                          <span className="font-bold text-foreground truncate max-w-[150px]">
                            {act.dealerName}
                          </span>
                        </div>
                        {act.storeName && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {act.storeName} {act.dealerCity ? `(${act.dealerCity})` : ""}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {isOrder ? `₹${act.totalAmount.toLocaleString("en-IN")}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600">
                        {isOrder ? `₹${act.paidAmount.toLocaleString("en-IN")}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {isOrder ? (
                          <span className={act.outstandingAmount > 0 ? "text-rose-600 font-bold" : "text-muted-foreground"}>
                            ₹{act.outstandingAmount.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-mono">
                            ₹{act.outstandingAmount.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] py-0 uppercase">
                          {act.paymentMode || (isOrder ? "CREDIT" : "LOOKUP")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedActivity(act)}
                          className="h-7 px-2 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── Detail Modal (Itemized Order or Lookup Details) ────────────────── */}
      <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedActivity && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedActivity.action === "ORDER_PLACED" ? (
                    <Badge className="bg-emerald-600 text-white font-semibold text-xs">
                      Wholesale Order Placed
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-600 text-white font-semibold text-xs">
                      Dealer Lookup / Shop Visit
                    </Badge>
                  )}
                  {selectedActivity.invoiceNumber && (
                    <Badge variant="outline" className="font-mono text-xs">
                      #{selectedActivity.invoiceNumber}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatISTDateTime(selectedActivity.createdAt)}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold mt-1 text-foreground">
                  {selectedActivity.storeName || selectedActivity.dealerName}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Action taken by <strong>{selectedActivity.staffName}</strong> ({selectedActivity.staffPhone || "Staff"})
                </DialogDescription>
              </DialogHeader>

              {/* Dealer Profile Card */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                    Dealer 4-Digit ID
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    #{selectedActivity.fourDigitId || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                    Dealer Code
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {selectedActivity.dealerCode || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                    Dealer Mobile
                  </span>
                  <span className="font-mono text-foreground">
                    {selectedActivity.dealerPhone || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                    City / Location
                  </span>
                  <span className="text-foreground truncate">
                    {selectedActivity.dealerCity || "N/A"}
                  </span>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-secondary/40 rounded-xl border border-border/40">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    {selectedActivity.action === "ORDER_PLACED" ? "Grand Total" : "Credit Limit"}
                  </span>
                  <span className="text-base font-bold font-mono text-foreground">
                    ₹{selectedActivity.totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-300 block">
                    {selectedActivity.action === "ORDER_PLACED" ? "Paid Amount" : "Total Paid"}
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{selectedActivity.paidAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className={`p-3 rounded-xl border ${
                  selectedActivity.outstandingAmount > 0
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-600"
                    : "bg-muted/40 border-border/40 text-muted-foreground"
                }`}>
                  <span className="text-[10px] uppercase font-semibold block">
                    {selectedActivity.action === "ORDER_PLACED" ? "Balance Udhaar" : "Current Udhaar"}
                  </span>
                  <span className="text-base font-bold font-mono">
                    ₹{selectedActivity.outstandingAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Itemized Products Table if Order */}
              {selectedActivity.action === "ORDER_PLACED" && modalItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    Itemized Ordered Products ({modalItems.length})
                  </h4>
                  <div className="border border-border/60 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/80 text-muted-foreground font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3 text-center">Peti Qty</th>
                          <th className="py-2 px-3 text-right">Rate</th>
                          <th className="py-2 px-3 text-right">Tax</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {modalItems.map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-2 px-3 font-medium">
                              <div>{it.productName}</div>
                              {it.packSize && (
                                <div className="text-[10px] text-muted-foreground">{it.packSize}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">
                              {it.petiQuantity || it.petiQty || it.qty || 1} Peti
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              ₹{(it.dealerPrice || it.price || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                              {it.taxRate ? `${it.taxRate}%` : "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                              ₹{(it.total || 0).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Deal Notes & Remarks */}
              {selectedActivity.notes && (
                <div className="p-3 bg-secondary/40 rounded-xl border border-border/40 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Deal Notes / Instructions:
                  </span>
                  <p className="text-xs text-foreground whitespace-pre-wrap">
                    {selectedActivity.notes}
                  </p>
                </div>
              )}

              {/* Payment Proof Slip Thumbnail */}
              {selectedActivity.proofUrl && (
                <div className="p-3 bg-muted/30 rounded-xl border border-border/40 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Payment Slip / Transfer Proof:
                  </span>
                  <a
                    href={selectedActivity.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block border border-border/60 rounded-lg overflow-hidden hover:opacity-90 transition"
                  >
                    <img
                      src={selectedActivity.proofUrl}
                      alt="Payment Slip Proof"
                      className="max-h-48 rounded-lg object-contain bg-black/5 p-1"
                    />
                  </a>
                </div>
              )}

              {/* Footer Button */}
              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedActivity(null)}
                  className="text-xs"
                >
                  Close Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
