import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useState, useEffect, useMemo } from "react";
import { Alert, ScrollView, StyleSheet, View, TouchableOpacity, Share, Image, ActivityIndicator } from "react-native";
import { Button, Card, HelperText, List, Text, TextInput, IconButton } from "react-native-paper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import * as ImagePicker from "expo-image-picker";

import { createDayEndReport, fetchDayEndReports, fetchDaySummary, fetchTasks, uploadPhoto, DayEndReport } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useAttendance } from "../hooks/useAttendance";
import { API_ORIGIN_URL } from "../config/env";

function buildAdminEquivalentDerHtml({
  report,
  user,
  tasks = [],
  workTimeLabel = "0h 0m",
  breakTimeLabel = "0h 0m",
  monthToDateKm = 0
}: {
  report: any;
  user: any;
  tasks?: any[];
  workTimeLabel?: string;
  breakTimeLabel?: string;
  monthToDateKm?: number;
}) {
  const formattedDate = dayjs(report.date).format("DD MMM YYYY");
  const formattedSubmittedAt = dayjs(report.submittedAt || report.createdAt || new Date()).format("DD MMM YYYY hh:mm A");
  const reportDateStr = dayjs(report.date).format("YYYY-MM-DD");

  // Only get completed tasks for this day
  const completedTasks = tasks.filter((t: any) =>
    t.status === "COMPLETED" &&
    (
      (t.completedAt && dayjs(t.completedAt).format("YYYY-MM-DD") === reportDateStr) ||
      dayjs(t.dueDate).format("YYYY-MM-DD") === reportDateStr ||
      dayjs(t.updatedAt).format("YYYY-MM-DD") === reportDateStr
    )
  );
  const completedCount = completedTasks.length;
  const totalDayTasksCount = tasks.length > 0 ? tasks.length : completedCount;
  const countBannerText = `${completedCount} / ${totalDayTasksCount} Completed (${totalDayTasksCount > 0 ? Math.round((completedCount / totalDayTasksCount) * 100) : 100}%)`;

  const formatTaskDetails = (t: any): string => {
    let locationCoords = "";
    if (t.completionLat != null && t.completionLng != null) {
      locationCoords = `${Number(t.completionLat).toFixed(4)}, ${Number(t.completionLng).toFixed(4)}`;
    } else if (t.lat != null && t.lng != null) {
      locationCoords = `${Number(t.lat).toFixed(4)}, ${Number(t.lng).toFixed(4)}`;
    }

    if (t.checklistResponses && Array.isArray(t.checklistResponses) && t.checklistResponses.length > 0) {
      let name = "";
      let contact = "";
      let village = "";
      let crop = "";
      let land = "";
      let product = "";
      let extraParts: string[] = [];

      for (const item of t.checklistResponses) {
        const val = item.value !== undefined ? String(item.value).trim() : (item.response !== undefined ? String(item.response).trim() : (item.text !== undefined ? String(item.text).trim() : ""));
        if (!val || item.type === "IMAGE" || item.type === "VIDEO" || item.type === "AUDIO") continue;
        
        const title = (item.title || item.label || item.id || "").toLowerCase();
        if (item.type === "GEOTAG" || title.includes("location") || title.includes("geotag")) {
          if (!locationCoords) locationCoords = val;
        } else if (title.includes("farmer name") || title.includes("dealer name") || title === "name") {
          name = val;
        } else if (title.includes("contact") || title.includes("phone") || title.includes("mobile")) {
          contact = val;
        } else if (title.includes("village")) {
          village = val;
        } else if (title.includes("crop")) {
          crop = val;
        } else if (title.includes("farmland") || title.includes("land") || title.includes("acre")) {
          land = val;
        } else if (title.includes("product")) {
          product = val;
        } else if (!title.includes("remark")) {
          extraParts.push(`${item.title || item.label}: ${val}`);
        }
      }

      const parts: string[] = [];
      if (name) parts.push(`<strong style="color: #0f172a;">${name}</strong>`);
      if (village) parts.push(`📍 ${village}`);
      if (crop) parts.push(`🌾 ${crop}${land ? ` (${land} Acr)` : ''}`);
      else if (land) parts.push(`🏡 ${land} Acr`);
      if (product) parts.push(`📦 ${product}`);
      if (contact) parts.push(`📞 ${contact}`);
      if (locationCoords) parts.push(`🌐 <span style="color: #0284c7; font-weight: 600;">${locationCoords}</span>`);
      if (extraParts.length > 0) parts.push(...extraParts.slice(0, 2));

      if (parts.length > 0) return parts.join(" &bull; ");
    }

    if (locationCoords) {
      return `${t.description ? t.description + ' &bull; ' : ''}🌐 <span style="color: #0284c7; font-weight: 600;">${locationCoords}</span>`;
    }

    return t.description || "";
  };

  const getTaskPhoto = (t: any): string | null => {
    let rawUrl = t.completionPhotoUrl;
    if (!rawUrl && t.checklistResponses && Array.isArray(t.checklistResponses)) {
      const img = t.checklistResponses.find((item: any) => 
        item.type === "IMAGE" && (item.fileUrl || item.photoUrl || item.image || item.url)
      );
      if (img) rawUrl = img.fileUrl || img.photoUrl || img.image || img.url;
    }
    if (!rawUrl) return null;
    return rawUrl.startsWith("http") ? rawUrl : `${API_ORIGIN_URL}${rawUrl}`;
  };

  const renderTaskCard = (t: any, isTwoCol: boolean) => {
    const details = formatTaskDetails(t);
    const photo = getTaskPhoto(t);
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: ${isTwoCol ? '3px 6px' : '4px 8px'}; border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: ${isTwoCol ? '9px' : '10px'}; line-height: 1.25; box-sizing: border-box; min-height: 32px;">
        <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; flex-wrap: wrap;">
          <span style="font-weight: 800; color: #16a34a; white-space: nowrap;">✅ ${t.title}</span>
          ${details ? `<span style="color: #334155;">— ${details}</span>` : ""}
          ${t.completionRemarks ? `<span style="color: #64748b; font-style: italic; font-size: 8.5px;">(${t.completionRemarks})</span>` : ""}
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 6px;">
          <span style="font-size: 8.5px; font-weight: 800; color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1px 4px; border-radius: 4px; white-space: nowrap;">+${t.points ?? 10} pts</span>
          ${photo ? `<img src="${photo}" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid #cbd5e1;" alt="Evidence" />` : ""}
        </div>
      </div>
    `;
  };

  let tasksGridHtml = "";
  if (completedTasks.length === 0) {
    tasksGridHtml = `<p style="font-size: 10px; color: #94a3b8; font-style: italic; margin: 0; padding: 4px 0;">No completed tasks recorded on this date.</p>`;
  } else if (completedTasks.length > 8) {
    let rows = "";
    for (let i = 0; i < completedTasks.length; i += 2) {
      const t1 = completedTasks[i];
      const t2 = completedTasks[i + 1];
      rows += `
        <tr>
          <td style="width: 50%; padding: 2px 3px 2px 0; vertical-align: middle;">${renderTaskCard(t1, true)}</td>
          <td style="width: 50%; padding: 2px 0 2px 3px; vertical-align: middle;">${t2 ? renderTaskCard(t2, true) : ""}</td>
        </tr>
      `;
    }
    tasksGridHtml = `<table style="width: 100%; border-collapse: collapse; table-layout: fixed;">${rows}</table>`;
  } else {
    tasksGridHtml = completedTasks.map(t => `<div style="margin-bottom: 4px;">${renderTaskCard(t, false)}</div>`).join("");
  }

  const startPhoto = report.startOdometerPhotoUrl ? (report.startOdometerPhotoUrl.startsWith("http") ? report.startOdometerPhotoUrl : `${API_ORIGIN_URL}${report.startOdometerPhotoUrl}`) : null;
  const endPhoto = report.kmPhotoUrl ? (report.kmPhotoUrl.startsWith("http") ? report.kmPhotoUrl : `${API_ORIGIN_URL}${report.kmPhotoUrl}`) : null;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Day End Report - ${formattedDate}</title>
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; padding: 12px 16px; background: #ffffff; margin: 0; }
        @media print {
          body { padding: 8px 12px; }
          @page { margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div style="max-width: 820px; margin: 0 auto;">
        <!-- Header Bar -->
        <div style="height: 4px; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%); border-radius: 2px; margin-bottom: 10px;"></div>

        <!-- Main Header Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
          <tr>
            <td style="vertical-align: top;">
              <h1 style="font-size: 18px; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.5px;">DAY END REPORT</h1>
              <p style="font-size: 9px; font-weight: 700; color: #2563eb; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.8px;">Vaniki Crop Science Pvt Ltd</p>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <h2 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0;">${user?.name || "Employee"}</h2>
              <p style="font-size: 9.5px; font-weight: 600; color: #64748b; margin: 2px 0 0 0;">${user?.designation || 'Field Representative'} &bull; ${user?.email || ""}</p>
            </td>
          </tr>
        </table>

        <!-- Meta Stats Row (4 Columns Compact) -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <tr>
            <td style="width: 25%; padding-right: 3px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 6px; text-align: center; box-sizing: border-box;">
                <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Report Date</p>
                <p style="font-size: 11px; font-weight: 800; color: #1e293b; margin: 0;">${formattedDate}</p>
              </div>
            </td>
            <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 6px; text-align: center; box-sizing: border-box;">
                <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Today Distance</p>
                <p style="font-size: 11px; font-weight: 800; color: #2563eb; margin: 0;">${report.kmTravelled ?? report.totalKmTravelled ?? 0} KM</p>
              </div>
            </td>
            <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 6px; text-align: center; box-sizing: border-box;">
                <p style="font-size: 7.5px; font-weight: 700; color: #1e40af; text-transform: uppercase; margin: 0 0 2px 0;">MTD Distance</p>
                <p style="font-size: 11px; font-weight: 800; color: #1d4ed8; margin: 0;">${monthToDateKm} KM</p>
              </div>
            </td>
            <td style="width: 25%; padding-left: 3px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 6px; text-align: center; box-sizing: border-box;">
                <p style="font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Submitted At</p>
                <p style="font-size: 10px; font-weight: 800; color: #1e293b; margin: 0;">${formattedSubmittedAt}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Orders & Working Metrics (Grid) -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <tr>
            <td style="width: 25%; padding-right: 3px;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box;">
                <span style="font-size: 7.5px; font-weight: 700; color: #166534; text-transform: uppercase;">Orders Booked:</span>
                <span style="font-size: 12px; font-weight: 800; color: #14532d; margin-left: 4px;">${report.ordersTaken ?? 0}</span>
              </div>
            </td>
            <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 5px 8px; box-sizing: border-box;">
                <span style="font-size: 7.5px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Cancelled:</span>
                <span style="font-size: 12px; font-weight: 800; color: #7f1d1d; margin-left: 4px;">${report.ordersCancelled ?? 0}</span>
              </div>
            </td>
            <td style="width: 25%; padding-right: 3px; padding-left: 3px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box;">
                <span style="font-size: 7.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Work Time:</span>
                <span style="font-size: 11px; font-weight: 800; color: #166534; margin-left: 4px;">${workTimeLabel}</span>
              </div>
            </td>
            <td style="width: 25%; padding-left: 3px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box;">
                <span style="font-size: 7.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Break Time:</span>
                <span style="font-size: 11px; font-weight: 800; color: #b45309; margin-left: 4px;">${breakTimeLabel}</span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Odometer Readings -->
        ${(report.startOdometer !== null && report.startOdometer !== undefined) || (report.endOdometer !== null && report.endOdometer !== undefined) ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; margin-bottom: 8px; box-sizing: border-box;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%;">
                <span style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">Start Odometer: </span>
                <span style="font-size: 11px; font-weight: 800; color: #1e293b;">${report.startOdometer !== null && report.startOdometer !== undefined ? report.startOdometer + ' km' : '--'}</span>
              </td>
              <td style="width: 50%;">
                <span style="font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase;">End Odometer: </span>
                <span style="font-size: 11px; font-weight: 800; color: #1e293b;">${report.endOdometer !== null && report.endOdometer !== undefined ? report.endOdometer + ' km' : '--'}</span>
              </td>
            </tr>
          </table>
        </div>
        ` : ''}

        <!-- Tasks Completed -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 5px;">
            <h3 style="font-size: 10px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">Tasks Completed Today</h3>
            <span style="font-size: 9px; font-weight: 700; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1px 5px; border-radius: 3px;">
              ✅ ${countBannerText}
            </span>
          </div>
          <div>
            ${tasksGridHtml}
          </div>
        </div>

        <!-- Work Summary & Remarks -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <tr>
            <td style="width: ${report.remarks ? '50%' : '100%'}; padding-right: ${report.remarks ? '4px' : '0'}; vertical-align: top;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box; min-height: 40px;">
                <h4 style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Work Summary</h4>
                <p style="font-size: 9.5px; line-height: 1.3; color: #334155; margin: 0;">${report.visitsSummary || "Field Work Mode"}</p>
              </div>
            </td>
            ${report.remarks ? `
            <td style="width: 50%; padding-left: 4px; vertical-align: top;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; box-sizing: border-box; min-height: 40px;">
                <h4 style="font-size: 7.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 2px 0;">Remarks</h4>
                <p style="font-size: 9.5px; font-style: italic; line-height: 1.3; color: #64748b; margin: 0;">${report.remarks}</p>
              </div>
            </td>
            ` : ''}
          </tr>
        </table>

        <!-- Verification Media -->
        ${startPhoto || endPhoto ? `
        <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 4px; box-sizing: border-box;">
          <h3 style="font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin: 0 0 4px 0; letter-spacing: 0.5px;">Verification Photos</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              ${startPhoto ? `
              <td style="width: 50%; padding-right: 4px; text-align: center; vertical-align: top;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; box-sizing: border-box;">
                  <p style="font-size: 7.5px; font-weight: 700; color: #64748b; margin: 0 0 2px 0; text-transform: uppercase;">Start Odometer</p>
                  <img src="${startPhoto}" style="max-width: 100%; max-height: 70px; border-radius: 3px; object-fit: contain;" />
                </div>
              </td>
              ` : ''}
              ${endPhoto ? `
              <td style="width: 50%; padding-left: 4px; text-align: center; vertical-align: top;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; box-sizing: border-box;">
                  <p style="font-size: 7.5px; font-weight: 700; color: #64748b; margin: 0 0 2px 0; text-transform: uppercase;">End Odometer</p>
                  <img src="${endPhoto}" style="max-width: 100%; max-height: 70px; border-radius: 3px; object-fit: contain;" />
                </div>
              </td>
              ` : ''}
            </tr>
          </table>
        </div>
        ` : ''}

        <div style="text-align: center; margin-top: 12px; font-size: 8.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px;">
          System-generated Document &bull; StaffTrack &copy; ${dayjs().year()} &bull; Vaniki Crop Science
        </div>
      </div>
    </body>
    </html>
  `;
}

type ReportForm = {
  visitsMeetings: string;
  ordersTaken: string;
  ordersCancelled: string;
  startOdometer: string;
  endOdometer: string;
  startOdometerPhotoUrl: string;
  kmPhotoUrl: string;
  remarks: string;
};

const initialForm: ReportForm = {
  visitsMeetings: "",
  ordersTaken: "",
  ordersCancelled: "0",
  startOdometer: "",
  endOdometer: "",
  startOdometerPhotoUrl: "",
  kmPhotoUrl: "",
  remarks: ""
};

export function DayEndReportScreen() {
  const { user } = useAuth();
  const { todayAttendance } = useAttendance();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReportForm>(initialForm);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const queryKey = ["dayEndReports", user?.id];
  const isFieldWorkday = todayAttendance?.punchType === "FIELD" || user?.workMode === "FIELD";

  const isSalesOfficer = useMemo(() => {
    const d = (user?.designation || "").trim().toLowerCase();
    if (
      d.includes("field assistant") ||
      d.includes("f/a") ||
      d.includes("f.a") ||
      d.includes("field-assistant") ||
      d.includes("assistant")
    ) {
      return false;
    }
    return true;
  }, [user?.designation]);

  const requireOdometer = isFieldWorkday && isSalesOfficer;

  const [remarksInput, setRemarksInput] = useState("");

  const historyQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey,
    queryFn: () => fetchDayEndReports(user!.id)
  });

  const todayReport = (historyQuery.data ?? []).find(r => dayjs(r.date).isSame(dayjs(), "day"));

  // ---- Day Summary (date-filtered, richer breakdown + PDF export) ----
  const [summaryDate, setSummaryDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [isExporting, setIsExporting] = useState(false);
  const daySummaryQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey: ["daySummary", user?.id, summaryDate],
    queryFn: () => fetchDaySummary(user!.id, summaryDate)
  });
  const summary = daySummaryQuery.data;
  const isToday = dayjs(summaryDate).isSame(dayjs(), "day");

  function fmtTime(value?: string | null) {
    return value ? dayjs(value).format("hh:mm A") : "—";
  }

  async function handleExportSummaryPDF() {
    setIsExporting(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Sharing not available", "Sharing is not supported on this device.");
        return;
      }

      const reportDateStr = summaryDate;
      const targetReport = (historyQuery.data ?? []).find(r => dayjs(r.date).format("YYYY-MM-DD") === reportDateStr) || {
        date: reportDateStr,
        kmTravelled: summary?.attendance?.kmTravelled || 0,
        ordersTaken: 0,
        ordersCancelled: 0,
        startOdometer: summary?.attendance?.startOdometer,
        endOdometer: summary?.attendance?.endOdometer,
        visitsSummary: summary?.attendance ? "Field Work Mode" : "Office Work",
        remarks: todayReport?.remarks || ""
      };

      // Fetch tasks for this date
      let dayTasks: any[] = [];
      try {
        dayTasks = await fetchTasks(reportDateStr);
      } catch (err) {
        dayTasks = summary?.tasks?.completed || [];
      }

      // Calculate month to date distance
      const startOfMonth = dayjs(reportDateStr).startOf("month");
      const currentDay = dayjs(reportDateStr);
      const mtdReports = (historyQuery.data ?? []).filter((r: any) => {
        const d = dayjs(r.date);
        return (d.isAfter(startOfMonth) || d.isSame(startOfMonth, "day")) &&
               (d.isBefore(currentDay) || d.isSame(currentDay, "day"));
      });
      const monthToDateKm = mtdReports.reduce((sum: number, r: any) => sum + (r.kmTravelled ?? r.totalKmTravelled ?? 0), 0);

      // Work & Break time
      const checkInTime = summary?.attendance?.checkInTime;
      const checkOutTime = summary?.attendance?.checkOutTime;
      let workTimeLabel = "0h 0m";
      if (checkInTime && checkOutTime) {
        const mins = dayjs(checkOutTime).diff(dayjs(checkInTime), "minute");
        workTimeLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      } else if (checkInTime) {
        const mins = dayjs().diff(dayjs(checkInTime), "minute");
        workTimeLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      }

      const html = buildAdminEquivalentDerHtml({
        report: targetReport,
        user: summary?.user || user,
        tasks: dayTasks,
        workTimeLabel,
        breakTimeLabel: "0h 0m",
        monthToDateKm: monthToDateKm || targetReport.kmTravelled || 0
      });

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Day End Report - ${dayjs(reportDateStr).format("DD MMM YYYY")}`,
        UTI: "com.adobe.pdf"
      });
    } catch (error) {
      Alert.alert("Export failed", "Could not generate the report PDF.");
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    if (todayReport) {
      setRemarksInput(todayReport.remarks || "");
    }
  }, [todayReport?.id]);

  const updateRemarksMutation = useMutation({
    mutationFn: (newRemarks: string) =>
      createDayEndReport({
        date: dayjs().format("YYYY-MM-DD"),
        visitsSummary: todayReport?.visitsSummary || "Field Work Mode",
        ordersTaken: todayReport?.ordersTaken ?? 0,
        ordersCancelled: todayReport?.ordersCancelled ?? 0,
        kmTravelled: todayReport?.kmTravelled ?? 0,
        remarks: newRemarks.trim()
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      Alert.alert("Success", "Your remarks have been updated.");
    },
    onError: (error) => {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Please try again.");
    }
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      createDayEndReport({
        date: dayjs().format("YYYY-MM-DD"),
        visitsSummary: form.visitsMeetings.trim(),
        ordersTaken: toNumber(form.ordersTaken),
        ordersCancelled: toNumber(form.ordersCancelled || "0"),
        kmTravelled: toNumber(form.endOdometer) - toNumber(form.startOdometer),
        totalKmTravelled: toNumber(form.endOdometer) - toNumber(form.startOdometer),
        startOdometer: toNumber(form.startOdometer),
        endOdometer: toNumber(form.endOdometer),
        startOdometerPhotoUrl: form.startOdometerPhotoUrl || undefined,
        kmPhotoUrl: form.kmPhotoUrl || undefined,
        remarks: form.remarks.trim()
      }),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey });
      Alert.alert("Report submitted", "Your day end report has been saved.");
    },
    onError: (error) => {
      Alert.alert("Submission failed", error instanceof Error ? error.message : "Please try again.");
    }
  });

  const history = historyQuery.data ?? [];
  const alreadySubmittedToday = history.some((report) => dayjs(report.date).isSame(dayjs(), "day"));
  const hasFormError =
    !form.visitsMeetings.trim() ||
    !form.ordersTaken.trim() ||
    (requireOdometer && (!form.startOdometer.trim() || !form.endOdometer.trim()));
  const [isCapturingStart, setIsCapturingStart] = useState(false);
  const [isCapturingEnd, setIsCapturingEnd] = useState(false);

  async function handlePickPhoto(type: 'start' | 'end') {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission denied", "Camera access is needed for odometer verification.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.3,
        allowsEditing: true,
        aspect: [4, 3]
      });

      if (!result.canceled && result.assets[0]) {
        type === 'start' ? setIsCapturingStart(true) : setIsCapturingEnd(true);
        const url = await uploadPhoto(result.assets[0]);
        setForm((prev) => ({ 
          ...prev, 
          [type === 'start' ? 'startOdometerPhotoUrl' : 'kmPhotoUrl']: url 
        }));
      }
    } catch (error) {
      Alert.alert("Photo failed", "Could not capture odometer photo.");
    } finally {
      setIsCapturingStart(false);
      setIsCapturingEnd(false);
    }
  }

  async function handleShareText(report: any) {
    setIsSharing(report.id);
    try {
      const startPhoto = report.startOdometerPhotoUrl ? (report.startOdometerPhotoUrl.startsWith("http") ? report.startOdometerPhotoUrl : `${API_ORIGIN_URL}${report.startOdometerPhotoUrl}`) : null;
      const endPhoto = report.kmPhotoUrl ? (report.kmPhotoUrl.startsWith("http") ? report.kmPhotoUrl : `${API_ORIGIN_URL}${report.kmPhotoUrl}`) : null;

      let shareMessage = `📋 STAFFTRACK DAY END REPORT\n`;
      shareMessage += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      shareMessage += `📅 Date: ${dayjs(report.date).format("DD MMMM YYYY")}\n`;
      shareMessage += `👤 Staff: ${user?.name || "Employee"}\n`;
      shareMessage += `🏷️ Mode: ${isFieldWorkday ? "Field" : "Office"}\n\n`;

      if (isFieldWorkday) {
        shareMessage += `🚗 Odometer Details:\n`;
        if (report.startOdometer !== undefined && report.startOdometer !== null) {
          shareMessage += `  🏁 Start Reading: ${report.startOdometer} KM\n`;
        }
        if (startPhoto) {
          shareMessage += `  📸 Start Photo: ${startPhoto}\n`;
        }
        if (report.endOdometer !== undefined && report.endOdometer !== null) {
          shareMessage += `  🏁 End Reading: ${report.endOdometer} KM\n`;
        }
        if (endPhoto) {
          shareMessage += `  📸 End Photo: ${endPhoto}\n`;
        }
        if (!startPhoto && !endPhoto && report.startOdometer === undefined && report.endOdometer === undefined) {
          shareMessage += `  ⚠️ Photos/Readings not available\n`;
        }
        shareMessage += `\n`;
      }
      
      shareMessage += `📊 Summary:\n`;
      shareMessage += `  🛣️ Distance: ${report.kmTravelled || report.totalKmTravelled || 0} KM\n`;
      shareMessage += `  ✅ Tasks Done: ${report.completedTasksCount ?? 0}\n`;
      shareMessage += `  ⭐ Points: ${report.totalPoints ?? 0}\n`;
      
      if (report.remarks && report.remarks.trim() && !report.remarks.includes("Auto-generated")) {
        shareMessage += `\n💬 Remarks: ${report.remarks}\n`;
      }

      shareMessage += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      shareMessage += `Powered by StaffTrack`;

      await Share.share({
        title: "Day End Report",
        message: shareMessage
      });
    } catch (error) {
      Alert.alert("Sharing failed", "Could not share the report.");
    } finally {
      setIsSharing(null);
    }
  }

  async function handleSharePDF(report: any) {
    setIsSharing(report.id);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Sharing not available", "Sharing is not supported on this device.");
        return;
      }

      const reportDateStr = dayjs(report.date).format("YYYY-MM-DD");

      // Fetch tasks for this date
      let dayTasks: any[] = [];
      try {
        dayTasks = await fetchTasks(reportDateStr);
      } catch (err) {
        dayTasks = [];
      }

      // Calculate month to date distance
      const startOfMonth = dayjs(reportDateStr).startOf("month");
      const currentDay = dayjs(reportDateStr);
      const mtdReports = (historyQuery.data ?? []).filter((r: any) => {
        const d = dayjs(r.date);
        return (d.isAfter(startOfMonth) || d.isSame(startOfMonth, "day")) &&
               (d.isBefore(currentDay) || d.isSame(currentDay, "day"));
      });
      const monthToDateKm = mtdReports.reduce((sum: number, r: any) => sum + (r.kmTravelled ?? r.totalKmTravelled ?? 0), 0);

      // Work & Break time
      let workTimeLabel = "0h 0m";
      if (todayAttendance?.checkInTime && todayAttendance?.checkOutTime) {
        const mins = dayjs(todayAttendance.checkOutTime).diff(dayjs(todayAttendance.checkInTime), "minute");
        workTimeLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      } else if (todayAttendance?.checkInTime) {
        const mins = dayjs().diff(dayjs(todayAttendance.checkInTime), "minute");
        workTimeLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      }

      const htmlContent = buildAdminEquivalentDerHtml({
        report,
        user,
        tasks: dayTasks,
        workTimeLabel,
        breakTimeLabel: "0h 0m",
        monthToDateKm: monthToDateKm || report.kmTravelled || 0
      });

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Day End Report - ${dayjs(report.date).format("DD MMM YYYY")}`,
        UTI: "com.adobe.pdf"
      });
    } catch (error) {
      Alert.alert("Sharing failed", "Could not share the report as PDF.");
    } finally {
      setIsSharing(null);
    }
  }

  function handleShare(report: any) {
    Alert.alert(
      "Share Report",
      "Select format to share today's report:",
      [
        {
          text: "📄 Share PDF (with Photos)",
          onPress: () => handleSharePDF(report)
        },
        {
          text: "💬 Share Text Message",
          onPress: () => handleShareText(report)
        },
        {
          text: "Cancel",
          style: "cancel"
        }
      ]
    );
  }

  function handleSubmit() {
    if (alreadySubmittedToday) {
      return;
    }

    if (hasFormError) {
      Alert.alert("Missing details", requireOdometer ? "Visits, orders, and both odometer readings are required." : "Visits and orders are required.");
      return;
    }

    const start = toNumber(form.startOdometer);
    const end = toNumber(form.endOdometer);

    if (requireOdometer && end <= start) {
      Alert.alert("Invalid readings", "End odometer reading must be greater than start reading.");
      return;
    }

    if (requireOdometer && (!form.startOdometerPhotoUrl || !form.kmPhotoUrl)) {
      Alert.alert("Photos required", "Please capture photos of both Start and End odometer readings.");
      return;
    }

    submitMutation.mutate();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={styles.title} variant="titleLarge">Day Summary</Text>
            <Button
              compact
              mode="contained"
              icon="file-pdf-box"
              loading={isExporting}
              disabled={isExporting || !summary}
              onPress={handleExportSummaryPDF}
            >
              Export PDF
            </Button>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <IconButton icon="chevron-left" mode="outlined" size={20} onPress={() => setSummaryDate(dayjs(summaryDate).subtract(1, "day").format("YYYY-MM-DD"))} />
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontWeight: "800", fontSize: 15, color: "#0F172A" }}>{dayjs(summaryDate).format("DD MMM YYYY")}</Text>
              {!isToday && (
                <TouchableOpacity onPress={() => setSummaryDate(dayjs().format("YYYY-MM-DD"))}>
                  <Text style={{ fontSize: 11, color: "#2563EB", fontWeight: "700" }}>Jump to Today</Text>
                </TouchableOpacity>
              )}
            </View>
            <IconButton icon="chevron-right" mode="outlined" size={20} disabled={isToday} onPress={() => setSummaryDate(dayjs(summaryDate).add(1, "day").format("YYYY-MM-DD"))} />
          </View>

          {daySummaryQuery.isLoading ? (
            <ActivityIndicator style={{ marginVertical: 16 }} />
          ) : summary ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={styles.summaryStat}><Text style={styles.summaryStatLabel}>CHECK-IN</Text><Text style={styles.summaryStatValue}>{fmtTime(summary.attendance?.checkInTime)}</Text></View>
                <View style={styles.summaryStat}><Text style={styles.summaryStatLabel}>CHECK-OUT</Text><Text style={styles.summaryStatValue}>{fmtTime(summary.attendance?.checkOutTime)}</Text></View>
                <View style={styles.summaryStat}><Text style={styles.summaryStatLabel}>KM</Text><Text style={styles.summaryStatValue}>{summary.attendance?.kmTravelled ?? 0}</Text></View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={styles.summaryStat}><Text style={styles.summaryStatLabel}>COMPLETED</Text><Text style={styles.summaryStatValue}>{summary.tasks?.completedCount ?? 0}</Text></View>
                <View style={styles.summaryStat}><Text style={styles.summaryStatLabel}>PENDING</Text><Text style={styles.summaryStatValue}>{summary.tasks?.pendingCount ?? 0}</Text></View>
                <View style={styles.summaryStat}><Text style={styles.summaryStatLabel}>TASK PTS</Text><Text style={styles.summaryStatValue}>{summary.points?.taskPointsEarned ?? 0}/{summary.points?.taskPointsPossible ?? 0}</Text></View>
                <View style={styles.summaryStat}><Text style={styles.summaryStatLabel}>TOTAL PTS</Text><Text style={styles.summaryStatValue}>{summary.points?.totalPoints ?? 0}</Text></View>
              </View>

              {(summary.tasks?.completed || []).length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.summarySectionTitle}>COMPLETED TASKS</Text>
                  {(summary.tasks.completed as any[]).map((t) => (
                    <View key={t.id} style={styles.summaryTaskCard}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontWeight: "700", color: "#0F172A", flex: 1 }}>✅ {t.title}</Text>
                        <Text style={{ fontWeight: "800", color: "#16A34A", fontSize: 12 }}>{t.points ?? 0} pts</Text>
                      </View>
                      {t.completionRemarks ? <Text style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{t.completionRemarks}</Text> : null}
                      {Array.isArray(t.checklistResponses) && t.checklistResponses.map((r: any, i: number) => (
                        <View key={i} style={{ flexDirection: "row", marginTop: 4 }}>
                          <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "600", flex: 1 }}>{r.title || r.type}</Text>
                          <Text style={{ fontSize: 11, color: "#334155", flex: 1 }}>
                            {r.type === "TEXT" || r.type === "DROPDOWN" ? (r.value || "—") : `[${r.type}]`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {(summary.tasks?.pending || []).length > 0 && (
                <View style={{ gap: 4 }}>
                  <Text style={styles.summarySectionTitle}>PENDING TASKS</Text>
                  {(summary.tasks.pending as any[]).map((t) => (
                    <Text key={t.id} style={{ fontSize: 12, color: "#475569" }}>• {t.title} ({t.points ?? 0} pts)</Text>
                  ))}
                </View>
              )}

              {(summary.forms || []).length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.summarySectionTitle}>FORMS SUBMITTED</Text>
                  {(summary.forms as any[]).map((f) => (
                    <View key={f.id} style={styles.summaryTaskCard}>
                      <Text style={{ fontWeight: "700", color: "#0F172A" }}>📝 {f.formName}</Text>
                      {(f.answers || []).map((a: any, i: number) => (
                        <View key={i} style={{ flexDirection: "row", marginTop: 4 }}>
                          <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "600", flex: 1 }}>{a.question}</Text>
                          <Text style={{ fontSize: 11, color: "#334155", flex: 1 }}>{a.answer}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>No data for this day.</Text>
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <Text style={styles.title} variant="titleLarge">
            Submit today's report
          </Text>
          {alreadySubmittedToday && todayReport ? (
            <View style={{ gap: 16 }}>
              <Text style={styles.submittedText}>Today's report has been generated successfully.</Text>
              
              <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" }}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "700" }}>VISITS</Text>
                  <Text style={{ fontSize: 14, color: "#0F172A", fontWeight: "800", marginTop: 4 }}>
                    {todayReport.visitsSummary?.split('|')[0] || todayReport.visitsSummary || "0"}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "700" }}>KM</Text>
                  <Text style={{ fontSize: 14, color: "#0F172A", fontWeight: "800", marginTop: 4 }}>
                    {todayReport.kmTravelled ?? todayReport.totalKmTravelled ?? 0} km
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "700" }}>ORDERS</Text>
                  <Text style={{ fontSize: 14, color: "#0F172A", fontWeight: "800", marginTop: 4 }}>
                    {todayReport.ordersTaken}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "700" }}>POINTS</Text>
                  <Text style={{ fontSize: 14, color: "#0F172A", fontWeight: "800", marginTop: 4 }}>
                    {todayReport.totalPoints ?? 0}
                  </Text>
                </View>
              </View>

              {isFieldWorkday && (todayReport.startOdometerPhotoUrl || todayReport.kmPhotoUrl || todayReport.startOdometer !== undefined) ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>TODAY'S ODOMETER READINGS</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {todayReport.startOdometerPhotoUrl ? (
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <LoadingImage
                          resizeMode="cover"
                          source={{ uri: todayReport.startOdometerPhotoUrl.startsWith("http") ? todayReport.startOdometerPhotoUrl : `${API_ORIGIN_URL}${todayReport.startOdometerPhotoUrl}` }}
                          style={{ width: "100%", height: 110, borderRadius: 6, borderWidth: 1, borderColor: "#E2E8F0" }}
                        />
                        <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "600", marginTop: 4 }}>
                          Start Day Odometer{todayReport.startOdometer !== undefined && todayReport.startOdometer !== null ? ` (${todayReport.startOdometer} km)` : ""}
                        </Text>
                      </View>
                    ) : null}
                    {todayReport.kmPhotoUrl ? (
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <LoadingImage
                          resizeMode="cover"
                          source={{ uri: todayReport.kmPhotoUrl.startsWith("http") ? todayReport.kmPhotoUrl : `${API_ORIGIN_URL}${todayReport.kmPhotoUrl}` }}
                          style={{ width: "100%", height: 110, borderRadius: 6, borderWidth: 1, borderColor: "#E2E8F0" }}
                        />
                        <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "600", marginTop: 4 }}>
                          End Day Odometer{todayReport.endOdometer !== undefined && todayReport.endOdometer !== null ? ` (${todayReport.endOdometer} km)` : ""}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#475569" }}>REMARKS</Text>
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  value={remarksInput}
                  onChangeText={setRemarksInput}
                  placeholder="Enter any work remarks for today..."
                  style={{ backgroundColor: "#FFFFFF" }}
                />
                <Button
                  mode="contained"
                  icon="check"
                  loading={updateRemarksMutation.isPending}
                  disabled={updateRemarksMutation.isPending}
                  onPress={() => updateRemarksMutation.mutate(remarksInput)}
                  style={{ marginTop: 4 }}
                >
                  Update Remarks
                </Button>
              </View>

              <Button 
                mode="outlined" 
                icon="share-variant" 
                loading={isSharing === todayReport.id}
                onPress={() => handleShare(todayReport)}
              >
                Share Today's Report
              </Button>
            </View>
          ) : isFieldWorkday ? (
            <View style={styles.officeInfoCard}>
              <Text style={styles.officeInfoTitle}>Field Work Mode Active</Text>
              <Text style={styles.officeInfoText}>
                Your Day End Report is automatically generated and updated upon check-out using your GPS logs and start/end odometer photo submissions.
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                keyboardType="number-pad"
                label="Number of visits/meetings"
                mode="outlined"
                onChangeText={(visitsMeetings) => setForm((current) => ({ ...current, visitsMeetings }))}
                value={form.visitsMeetings}
              />
              <View style={styles.row}>
                <TextInput
                  keyboardType="number-pad"
                  label="Orders taken"
                  mode="outlined"
                  onChangeText={(ordersTaken) => setForm((current) => ({ ...current, ordersTaken }))}
                  style={styles.halfInput}
                  value={form.ordersTaken}
                />
                <TextInput
                  keyboardType="number-pad"
                  label="Cancelled"
                  mode="outlined"
                  onChangeText={(ordersCancelled) => setForm((current) => ({ ...current, ordersCancelled }))}
                  style={styles.halfInput}
                  value={form.ordersCancelled}
                />
              </View>
              {requireOdometer ? (
              <View style={styles.odometerSection}>
                <Text style={styles.subTitle}>Odometer Readings</Text>
                
                <View style={styles.odometerRow}>
                  <View style={styles.odometerCol}>
                    <TextInput
                      keyboardType="number-pad"
                      label="Start Reading"
                      mode="outlined"
                      onChangeText={(startOdometer) => setForm((current) => ({ ...current, startOdometer }))}
                      value={form.startOdometer}
                      style={styles.odometerInput}
                    />
                    <Button
                      icon="camera"
                      loading={isCapturingStart}
                      mode="outlined"
                      onPress={() => handlePickPhoto('start')}
                      style={[styles.smallPhotoButton, form.startOdometerPhotoUrl ? styles.photoCaptured : {}]}
                    >
                      {form.startOdometerPhotoUrl ? "Start ✓" : "Start Photo"}
                    </Button>
                  </View>

                  <View style={styles.odometerCol}>
                    <TextInput
                      keyboardType="number-pad"
                      label="End Reading"
                      mode="outlined"
                      onChangeText={(endOdometer) => setForm((current) => ({ ...current, endOdometer }))}
                      value={form.endOdometer}
                      style={styles.odometerInput}
                    />
                    <Button
                      icon="camera"
                      loading={isCapturingEnd}
                      mode="outlined"
                      onPress={() => handlePickPhoto('end')}
                      style={[styles.smallPhotoButton, form.kmPhotoUrl ? styles.photoCaptured : {}]}
                    >
                      {form.kmPhotoUrl ? "End ✓" : "End Photo"}
                    </Button>
                  </View>
                </View>

                {form.startOdometer && form.endOdometer && (
                  <View style={styles.calculatedKm}>
                    <Text style={styles.kmLabel}>Total KM Travelled:</Text>
                    <Text style={styles.kmValue}>{toNumber(form.endOdometer) - toNumber(form.startOdometer)} KM</Text>
                  </View>
                )}
              </View>
              ) : null}

              <TextInput
                label="Remarks"
                mode="outlined"
                multiline
                numberOfLines={4}
                onChangeText={(remarks) => setForm((current) => ({ ...current, remarks }))}
                value={form.remarks}
              />
              <HelperText type="error" visible={hasFormError}>
                All fields and photos are mandatory.
              </HelperText>
              <Button
                disabled={submitMutation.isPending}
                icon="send"
                loading={submitMutation.isPending}
                mode="contained"
                onPress={handleSubmit}
              >
                Submit report
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      <Text style={styles.sectionTitle} variant="titleMedium">
        Previous reports
      </Text>
      {history.length === 0 ? (
        <Text style={styles.emptyText}>No reports submitted yet.</Text>
      ) : (
        history.map((item) => {
          const startPhoto = item.startOdometerPhotoUrl ? (item.startOdometerPhotoUrl.startsWith("http") ? item.startOdometerPhotoUrl : `${API_ORIGIN_URL}${item.startOdometerPhotoUrl}`) : null;
          const endPhoto = item.kmPhotoUrl ? (item.kmPhotoUrl.startsWith("http") ? item.kmPhotoUrl : `${API_ORIGIN_URL}${item.kmPhotoUrl}`) : null;

          return (
            <Card key={item.id} mode="contained" style={{ borderRadius: 12, marginBottom: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" }}>
              <Card.Content style={{ padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontWeight: "800", color: "#0F172A", fontSize: 15 }}>
                    {dayjs(item.date).format("DD MMMM YYYY")}
                  </Text>
                  <IconButton 
                    icon="share-variant" 
                    onPress={() => handleShare(item)} 
                    loading={isSharing === item.id}
                    size={20}
                    style={{ margin: 0 }}
                  />
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderRadius: 8, padding: 8, marginBottom: 12 }}>
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "700" }}>VISITS</Text>
                    <Text style={{ fontSize: 12, color: "#0F172A", fontWeight: "800", marginTop: 2 }}>
                      {item.visitsSummary?.split('|')[0] || item.visitsSummary || "0"}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "700" }}>KM</Text>
                    <Text style={{ fontSize: 12, color: "#0F172A", fontWeight: "800", marginTop: 2 }}>
                      {item.kmTravelled ?? item.totalKmTravelled ?? 0} km
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "700" }}>ORDERS</Text>
                    <Text style={{ fontSize: 12, color: "#0F172A", fontWeight: "800", marginTop: 2 }}>
                      {item.ordersTaken}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: "#E2E8F0" }} />
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "700" }}>POINTS</Text>
                    <Text style={{ fontSize: 12, color: "#0F172A", fontWeight: "800", marginTop: 2 }}>
                      {item.totalPoints ?? 0}
                    </Text>
                  </View>
                </View>

                {(startPhoto || endPhoto) && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    {startPhoto && (
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <LoadingImage
                          resizeMode="cover"
                          source={{ uri: startPhoto }}
                          style={{ width: "100%", height: 110, borderRadius: 6, borderWidth: 1, borderColor: "#E2E8F0" }}
                        />
                        <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "600", marginTop: 4 }}>
                          Start Day Odometer{item.startOdometer !== undefined && item.startOdometer !== null ? ` (${item.startOdometer} km)` : ""}
                        </Text>
                      </View>
                    )}
                    {endPhoto && (
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <LoadingImage
                          resizeMode="cover"
                          source={{ uri: endPhoto }}
                          style={{ width: "100%", height: 110, borderRadius: 6, borderWidth: 1, borderColor: "#E2E8F0" }}
                        />
                        <Text style={{ fontSize: 9, color: "#64748B", fontWeight: "600", marginTop: 4 }}>
                          End Day Odometer{item.endOdometer !== undefined && item.endOdometer !== null ? ` (${item.endOdometer} km)` : ""}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {item.remarks ? (
                  <View style={{ marginTop: 8, backgroundColor: "#FFFBEB", padding: 8, borderRadius: 6, borderWidth: 1, borderColor: "#FEF3C7" }}>
                    <Text style={{ fontSize: 10, color: "#B45309", fontWeight: "700" }}>REMARKS</Text>
                    <Text style={{ fontSize: 11, color: "#78350F", marginTop: 2 }}>{item.remarks}</Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

function toNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function LoadingImage({ source, style, resizeMode }: { source: any; style: any; resizeMode?: "cover" | "contain" | "stretch" | "center" }) {
  const [loading, setLoading] = useState(false);
  return (
    <View style={[{ position: "relative", overflow: "hidden" }, style]}>
      <Image
        resizeMode={resizeMode ?? "cover"}
        source={source}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", backgroundColor: "#F1F5F9" }]}>
          <ActivityIndicator color="#4A6583" size="small" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  content: {
    padding: 16
  },
  card: {
    borderRadius: 8,
    marginBottom: 20
  },
  title: {
    color: "#24312D",
    fontWeight: "700"
  },
  submittedText: {
    color: "#17633A",
    fontWeight: "700",
    marginTop: 16
  },
  form: {
    gap: 12,
    marginTop: 16
  },
  row: {
    flexDirection: "row",
    gap: 12
  },
  halfInput: {
    flex: 1
  },
  sectionTitle: {
    color: "#24312D",
    fontWeight: "700",
    marginBottom: 8
  },
  emptyText: {
    color: "#66736F",
    textAlign: "center"
  },
  historyItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 8
  },
  odometerSection: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12
  },
  odometerRow: {
    flexDirection: 'row',
    gap: 12
  },
  odometerCol: {
    flex: 1,
    gap: 8
  },
  odometerInput: {
    backgroundColor: 'white',
    height: 45
  },
  smallPhotoButton: {
    borderRadius: 8,
    height: 40,
    justifyContent: 'center'
  },
  photoCaptured: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A'
  },
  calculatedKm: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  kmLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B'
  },
  kmValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A'
  },
  officeInfoCard: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14
  },
  officeInfoTitle: {
    color: "#3730A3",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase"
  },
  officeInfoText: {
    color: "#4C5A7A",
    fontSize: 13,
    lineHeight: 18
  },
  summaryStat: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 8,
    alignItems: "center"
  },
  summaryStatLabel: {
    fontSize: 8,
    color: "#64748B",
    fontWeight: "700"
  },
  summaryStatValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "800",
    marginTop: 3
  },
  summarySectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  summaryTaskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10
  }
});
