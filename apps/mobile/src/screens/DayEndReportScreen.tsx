import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useState, useEffect, useMemo } from "react";
import { Alert, ScrollView, StyleSheet, View, TouchableOpacity, Share, Image, ActivityIndicator } from "react-native";
import { Button, Card, HelperText, List, Text, TextInput, IconButton } from "react-native-paper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import * as ImagePicker from "expo-image-picker";

import { createDayEndReport, fetchDayEndReports, fetchDaySummary, uploadPhoto, DayEndReport } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useAttendance } from "../hooks/useAttendance";
import { API_ORIGIN_URL } from "../config/env";

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
    if (!summary) return;
    setIsExporting(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      const dateStr = dayjs(summary.date).format("DD MMMM YYYY");
      const att = summary.attendance || {};
      const tasks = summary.tasks || {};
      const pts = summary.points || {};

      const completedHtml = (tasks.completed || []).map((t: any) => {
        const responses = Array.isArray(t.checklistResponses) ? t.checklistResponses : [];
        const qaHtml = responses.map((r: any) => {
          const val = r.type === "TEXT" || r.type === "DROPDOWN" ? (r.value || "—") : (r.fileUrl ? `[${r.type}]` : "—");
          return `<tr><td class="q">${r.title || r.type}</td><td>${val}</td></tr>`;
        }).join("");
        return `
          <div class="task">
            <div class="task-head">
              <span class="task-title">✅ ${t.title}</span>
              <span class="task-pts">${t.points ?? 0} pts</span>
            </div>
            ${t.description ? `<div class="task-desc">${t.description}</div>` : ""}
            ${t.completionRemarks ? `<div class="task-remark"><b>Remark:</b> ${t.completionRemarks}</div>` : ""}
            ${qaHtml ? `<table class="qa">${qaHtml}</table>` : ""}
          </div>`;
      }).join("");

      const pendingHtml = (tasks.pending || []).map((t: any) =>
        `<li>${t.title} <span style="color:#94A3B8">(${t.points ?? 0} pts)</span></li>`
      ).join("");

      const formsHtml = (summary.forms || []).map((f: any) => {
        const rows = (f.answers || []).map((a: any) => `<tr><td class="q">${a.question}</td><td>${a.answer}</td></tr>`).join("");
        return `<div class="task"><div class="task-head"><span class="task-title">📝 ${f.formName}</span></div><table class="qa">${rows}</table></div>`;
      }).join("");

      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8"/>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px; color: #1E293B; }
          h1 { color: #1A365D; font-size: 22px; margin: 0; text-align:center; }
          .sub { text-align:center; color:#64748B; font-size:12px; margin: 4px 0 18px; }
          .meta { width:100%; border-collapse:collapse; margin-bottom:16px; }
          .meta td { padding:7px 10px; border-bottom:1px solid #E2E8F0; font-size:13px; }
          .meta td.l { font-weight:bold; background:#F8FAFC; width:35%; }
          .grid { display:flex; gap:10px; margin:16px 0; }
          .stat { flex:1; background:#EFF6FF; border:1px solid #DBEAFE; border-radius:8px; padding:10px; text-align:center; }
          .stat .n { font-size:18px; font-weight:800; color:#1D4ED8; }
          .stat .l { font-size:9px; text-transform:uppercase; color:#64748B; font-weight:700; margin-top:4px; }
          h3 { color:#0F172A; font-size:14px; border-bottom:2px solid #E2E8F0; padding-bottom:6px; margin-top:24px; }
          .task { border:1px solid #E2E8F0; border-radius:8px; padding:10px; margin-bottom:10px; }
          .task-head { display:flex; justify-content:space-between; align-items:center; }
          .task-title { font-weight:700; font-size:13px; }
          .task-pts { font-size:11px; font-weight:800; color:#16A34A; }
          .task-desc { font-size:12px; color:#475569; margin-top:4px; }
          .task-remark { font-size:12px; color:#475569; margin-top:4px; }
          .qa { width:100%; border-collapse:collapse; margin-top:8px; }
          .qa td { padding:5px 8px; border-bottom:1px solid #F1F5F9; font-size:12px; }
          .qa td.q { font-weight:600; color:#475569; width:45%; }
          ul { margin:6px 0; padding-left:18px; font-size:12px; }
          .footer { text-align:center; margin-top:30px; font-size:10px; color:#94A3B8; }
        </style></head><body>
          <h1>STAFFTRACK DAY END REPORT</h1>
          <div class="sub">${dateStr}</div>
          <table class="meta">
            <tr><td class="l">Staff</td><td>${summary.user?.name || user?.name || "Employee"}</td></tr>
            <tr><td class="l">Check-in</td><td>${fmtTime(att.checkInTime)}</td></tr>
            <tr><td class="l">Check-out</td><td>${fmtTime(att.checkOutTime)}</td></tr>
            <tr><td class="l">Odometer</td><td>${att.startOdometer ?? "—"} → ${att.endOdometer ?? "—"} (${att.kmTravelled ?? 0} km)</td></tr>
          </table>
          <div class="grid">
            <div class="stat"><div class="n">${tasks.completedCount ?? 0}</div><div class="l">Completed</div></div>
            <div class="stat"><div class="n">${tasks.pendingCount ?? 0}</div><div class="l">Pending</div></div>
            <div class="stat"><div class="n">${pts.taskPointsEarned ?? 0}/${pts.taskPointsPossible ?? 0}</div><div class="l">Task Pts</div></div>
            <div class="stat"><div class="n">${pts.totalPoints ?? 0}</div><div class="l">Total Pts</div></div>
          </div>
          ${completedHtml ? `<h3>Completed Tasks</h3>${completedHtml}` : ""}
          ${pendingHtml ? `<h3>Pending Tasks</h3><ul>${pendingHtml}</ul>` : ""}
          ${formsHtml ? `<h3>Forms Submitted</h3>${formsHtml}` : ""}
          <div class="footer">System-generated • StaffTrack &copy; ${dayjs().year()}</div>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (isAvailable) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Day End Report - ${dateStr}`, UTI: "com.adobe.pdf" });
      } else {
        Alert.alert("PDF created", "Saved to: " + uri);
      }
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

      const startPhoto = report.startOdometerPhotoUrl ? (report.startOdometerPhotoUrl.startsWith("http") ? report.startOdometerPhotoUrl : `${API_ORIGIN_URL}${report.startOdometerPhotoUrl}`) : null;
      const endPhoto = report.kmPhotoUrl ? (report.kmPhotoUrl.startsWith("http") ? report.kmPhotoUrl : `${API_ORIGIN_URL}${report.kmPhotoUrl}`) : null;

      const dateStr = dayjs(report.date).format("DD MMMM YYYY");
      const userName = user?.name || "Employee";
      const modeStr = isFieldWorkday ? "Field" : "Office";
      const visits = report.visitsSummary?.split('|')[0] || report.visitsSummary || "0";
      const km = report.kmTravelled ?? report.totalKmTravelled ?? 0;
      const orders = report.ordersTaken ?? 0;
      const points = report.totalPoints ?? 0;

      let remarksHtml = "";
      if (report.remarks && report.remarks.trim() && !report.remarks.includes("Auto-generated")) {
        remarksHtml = `
          <div class="remarks-box">
            <div class="remarks-title">REMARKS</div>
            <div style="font-size: 13px; color: #4A5568; margin-top: 4px; line-height: 1.5;">${report.remarks}</div>
          </div>
        `;
      }

      let imagesHtml = "";
      if (isFieldWorkday && (startPhoto || endPhoto)) {
        imagesHtml = `
          <div class="images-section">
            <h3 style="color: #2D3748; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; font-size: 16px;">Odometer Photos</h3>
            <div class="images-container">
        `;
        if (startPhoto) {
          const startReadingText = report.startOdometer !== undefined && report.startOdometer !== null ? ` (${report.startOdometer} KM)` : "";
          imagesHtml += `
            <div class="img-box">
              <img src="${startPhoto}" />
              <div class="lbl">Start Day Odometer${startReadingText}</div>
            </div>
          `;
        }
        if (endPhoto) {
          const endReadingText = report.endOdometer !== undefined && report.endOdometer !== null ? ` (${report.endOdometer} KM)` : "";
          imagesHtml += `
            <div class="img-box">
              <img src="${endPhoto}" />
              <div class="lbl">End Day Odometer${endReadingText}</div>
            </div>
          `;
        }
        imagesHtml += `
            </div>
          </div>
        `;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Day End Report - ${dateStr}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 25px; color: #2D3748; background-color: #FFFFFF; }
            .header-container { text-align: center; border-bottom: 3px double #CBD5E0; padding-bottom: 15px; margin-bottom: 20px; }
            h1 { color: #1A365D; margin: 0; font-size: 24px; letter-spacing: 1px; }
            .subtitle { color: #718096; font-size: 12px; margin-top: 5px; font-weight: 500; }
            .meta-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .meta-table td { padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
            .meta-table td.label { font-weight: bold; color: #4A5568; width: 30%; background-color: #F7FAFC; }
            .summary-box { display: flex; justify-content: space-between; background: #EDF2F7; border-radius: 10px; padding: 15px; margin-top: 25px; border: 1px solid #E2E8F0; }
            .summary-item { text-align: center; flex: 1; }
            .summary-item:not(:last-child) { border-right: 1px solid #CBD5E0; }
            .summary-item .num { font-size: 18px; font-weight: 800; color: #1A365D; }
            .summary-item .lbl { font-size: 10px; color: #718096; text-transform: uppercase; margin-top: 5px; font-weight: bold; }
            .remarks-box { background: #FFFDF5; border: 1px solid #FEEBC8; border-radius: 8px; padding: 15px; margin-top: 25px; }
            .remarks-title { font-weight: bold; color: #B7791F; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            .images-section { margin-top: 30px; page-break-inside: avoid; }
            .images-container { display: flex; gap: 20px; justify-content: center; margin-top: 15px; }
            .img-box { text-align: center; width: 45%; max-width: 300px; display: inline-block; }
            .img-box img { width: 100%; height: auto; max-height: 250px; object-fit: contain; border-radius: 8px; border: 1px solid #CBD5E0; background-color: #F7FAFC; }
            .img-box .lbl { font-size: 11px; color: #4A5568; margin-top: 8px; font-weight: bold; text-transform: uppercase; }
            .footer { text-align: center; margin-top: 50px; font-size: 11px; color: #A0AEC0; border-top: 1px solid #E2E8F0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <h1>STAFFTRACK DAY END REPORT</h1>
            <div class="subtitle">Generated via StaffTrack Mobile Application</div>
          </div>

          <table class="meta-table">
            <tr><td class="label">Date</td><td>${dateStr}</td></tr>
            <tr><td class="label">Staff Name</td><td>${userName}</td></tr>
            <tr><td class="label">Work Mode</td><td>${modeStr}</td></tr>
          </table>

          <div class="summary-box">
            <div class="summary-item"><div class="num">${visits}</div><div class="lbl">Visits</div></div>
            <div class="summary-item"><div class="num">${km} KM</div><div class="lbl">Distance</div></div>
            <div class="summary-item"><div class="num">${orders}</div><div class="lbl">Orders</div></div>
            <div class="summary-item"><div class="num">${points}</div><div class="lbl">Points</div></div>
          </div>

          ${remarksHtml}

          ${imagesHtml}

          <div class="footer">
            This is a system-generated document.<br>
            StaffTrack &copy; ${dayjs().year()}
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Share Day End Report - ${dateStr}`,
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
