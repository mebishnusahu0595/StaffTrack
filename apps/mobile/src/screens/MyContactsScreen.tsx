import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Button, IconButton, Text, TextInput } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { appIconSource } from "../components/AppIcon";
import { fetchContactVisits, fetchMyContacts, type MyContact } from "../api";
import { API_ORIGIN_URL } from "../config/env";

type Kind = "farmer" | "dealer";

const fmt = (d?: string | null, f = "DD MMM YYYY") => (d ? dayjs(d).format(f) : "—");
const mins = (m?: number | null) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

const CACHE_KEY_CONTACTS = "@stafftrack:myContacts";

function toFullUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_ORIGIN_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function escapeHtml(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Farmers & dealers this staff member is (or was) assigned to, with what earlier visits recorded. */
export function MyContactsScreen() {
  const [kind, setKind] = useState<Kind>("farmer");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MyContact | null>(null);
  const [cachedContacts, setCachedContacts] = useState<{ farmers: MyContact[]; dealers: MyContact[] } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY_CONTACTS)
      .then((raw) => {
        if (raw) {
          try {
            setCachedContacts(JSON.parse(raw));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const contactsQuery = useQuery({
    queryKey: ["myContacts"],
    queryFn: fetchMyContacts,
    initialData: cachedContacts ?? undefined,
  });

  useEffect(() => {
    if (contactsQuery.data) {
      AsyncStorage.setItem(CACHE_KEY_CONTACTS, JSON.stringify(contactsQuery.data)).catch(() => {});
    }
  }, [contactsQuery.data]);

  const list = useMemo(() => {
    const data = contactsQuery.data || cachedContacts;
    const all = (kind === "farmer" ? data?.farmers : data?.dealers) ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) =>
      [c.name, c.phone, c.village, c.city, c.district, c.crop].some((v) => v?.toLowerCase().includes(q))
    );
  }, [contactsQuery.data, cachedContacts, kind, search]);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(["farmer", "dealer"] as Kind[]).map((k) => {
          const data = contactsQuery.data || cachedContacts;
          const count = (k === "farmer" ? data?.farmers : data?.dealers)?.length ?? 0;
          return (
            <TouchableOpacity key={k} onPress={() => setKind(k)} style={[styles.tab, kind === k && styles.tabActive]}>
              <Text style={[styles.tabText, kind === k && styles.tabTextActive]}>
                {k === "farmer" ? "Farmers" : "Dealers"} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        mode="outlined"
        dense
        placeholder="Search name, village, phone, crop..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {contactsQuery.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={contactsQuery.isRefetching} onRefresh={() => contactsQuery.refetch()} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {contactsQuery.isError ? "Could not load. Pull to retry." : `You haven't completed a ${kind} visit yet.`}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>
                  {[item.village, item.city, item.district, item.state].filter(Boolean).join(", ") || "—"}
                  {item.phone ? `  •  ${item.phone}` : ""}
                </Text>
                {kind === "farmer" && (item.crop || item.landSize) && (
                  <Text style={styles.sub}>
                    {item.crop ? `Crop: ${item.crop}` : ""}
                    {item.landSize ? `  Land: ${item.landSize}` : ""}
                  </Text>
                )}
                <Text style={styles.meta}>
                  You visited {item.myVisitCount} time{item.myVisitCount === 1 ? "" : "s"}  •  Last: {fmt(item.myLastVisitAt)}
                  {item.totalVisitCount > item.myVisitCount ? `  •  ${item.totalVisitCount} visits by all staff` : ""}
                </Text>
              </View>
              <View style={[styles.badge, item.isCurrentlyAssigned ? styles.badgeNow : styles.badgePast]}>
                <Text style={[styles.badgeText, { color: item.isCurrentlyAssigned ? "#047857" : "#64748B" }]}>
                  {item.isCurrentlyAssigned ? "Assigned" : "Visited"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          {selected && (
            <ContactDetail
              kind={kind}
              contact={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function ContactDetail({ kind, contact, onClose }: { kind: Kind; contact: MyContact; onClose: () => void }) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["contactVisits", kind, contact.id],
    queryFn: () => fetchContactVisits(kind, contact.id),
  });

  const summary = data?.summary;
  // only completed tasks count as a visit
  const visits = (data?.tasks ?? []).filter((t: any) => t?.status === "COMPLETED");
  const visitors = (summary?.staff ?? []).filter((s: any) => (s?.completed ?? 0) > 0);

  const handleDownloadPdf = async () => {
    if (!data) {
      Alert.alert("Please Wait", "Visit data is still loading...");
      return;
    }

    try {
      setIsGeneratingPdf(true);
      const html = generateReportHtml(kind, contact, data);
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Visit Report - ${contact.name}`
        });
      } else {
        Alert.alert("PDF Generated", "Visit report has been generated successfully.");
      }
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      Alert.alert("Error", `Could not generate PDF: ${err?.message || "Unknown error"}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Modal Header */}
      <View style={styles.modalHeader}>
        <IconButton icon={appIconSource("arrow-back")} onPress={onClose} size={22} />
        <View style={{ flex: 1, marginHorizontal: 4 }}>
          <Text style={styles.modalTitle} numberOfLines={1}>{contact.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[contact.village, contact.city, contact.district].filter(Boolean).join(", ") || "—"}
            {contact.phone ? `  •  ${contact.phone}` : ""}
          </Text>
        </View>
        <IconButton
          icon={appIconSource("close")}
          onPress={onClose}
          size={22}
        />
      </View>

      {/* PDF Download Action Bar */}
      <View style={styles.downloadBar}>
        <Button
          mode="contained"
          icon={appIconSource("download")}
          loading={isGeneratingPdf}
          disabled={isGeneratingPdf || isLoading || isError}
          onPress={handleDownloadPdf}
          buttonColor="#1E293B"
          textColor="#FFFFFF"
          style={styles.downloadBtn}
          contentStyle={{ height: 42 }}
        >
          {isGeneratingPdf ? "Generating PDF..." : "Download Report (PDF)"}
        </Button>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#1E293B" />
          <Text style={{ marginTop: 12, color: "#64748B", fontSize: 13 }}>Loading visit records...</Text>
        </View>
      ) : isError ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Text style={styles.empty}>Could not load visit details.</Text>
          <Button mode="outlined" onPress={() => refetch()} style={{ marginTop: 16 }}>
            Retry
          </Button>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 50 }}>
          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <Stat label="Visits" value={summary?.completedVisits ?? 0} />
            <Stat label="Staff" value={visitors.length} />
            <Stat label="Last Visit" value={fmt(summary?.lastVisit, "DD MMM")} />
          </View>

          {/* Latest Profile / Q&A */}
          <Text style={styles.section}>What was recorded (Latest Details)</Text>
          {data?.profile?.length ? (
            data.profile.map((p: any, i: number) => (
              <View key={i} style={styles.qa}>
                <Text style={styles.q}>{p.question}</Text>
                <AnswerView q={p} />
                <Text style={styles.by}>by {p.answeredBy || "Staff"} • {fmt(p.answeredAt)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.sub}>No visit form filled yet.</Text>
          )}

          {/* Who Visited */}
          <Text style={styles.section}>Staff Visitors ({visitors.length})</Text>
          {visitors.length > 0 ? (
            visitors.map((s: any) => (
              <View key={s.id || s.name} style={styles.staffRow}>
                <Text style={styles.staffName}>{s.name || "Unknown Staff"}</Text>
                <Text style={styles.sub}>
                  {s.completed} visit{s.completed === 1 ? "" : "s"}  •  Time: {mins(s.totalMinutes)}
                </Text>
                {Array.isArray(s.visitDates) && s.visitDates.length > 0 && (
                  <Text style={styles.by}>{s.visitDates.map((d: string) => fmt(d, "DD MMM, hh:mm A")).join("  •  ")}</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.sub}>No staff visit records found.</Text>
          )}

          {/* Visit History */}
          <Text style={styles.section}>Visit History ({visits.length})</Text>
          {visits.length > 0 ? (
            visits.map((t: any, idx: number) => (
              <View key={t.id || idx} style={styles.visit}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.staffName}>
                    {t.assignedTo?.name || "Staff Member"}
                  </Text>
                  <Text style={{ color: "#047857", fontWeight: "700", fontSize: 11 }}>COMPLETED</Text>
                </View>
                <Text style={styles.by}>
                  {t.completedAt ? `Done ${fmt(t.completedAt, "DD MMM YYYY, hh:mm A")}` : `Due ${fmt(t.dueDate)}`}
                  {t.durationMin != null ? `  •  ${mins(t.durationMin)}` : ""}
                </Text>
                {!!t.completionRemarks && (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksLabel}>Remarks:</Text>
                    <Text style={styles.remarks}>{t.completionRemarks}</Text>
                  </View>
                )}
                {(t.qa ?? []).map((q: any, i: number) => (
                  <View key={i} style={styles.qaSmall}>
                    <Text style={styles.q}>{q.question}</Text>
                    <AnswerView q={q} />
                  </View>
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.sub}>No completed visits recorded yet.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AnswerView({ q }: { q: any }) {
  const fullUrl = toFullUrl(q?.fileUrl);

  const handleOpenUrl = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch((err) => {
      console.warn("Could not open URL:", err);
      Alert.alert("Error", "Could not open link");
    });
  };

  if (fullUrl && q?.type === "IMAGE") {
    return (
      <TouchableOpacity onPress={() => handleOpenUrl(fullUrl)} activeOpacity={0.8}>
        <Image source={{ uri: fullUrl }} style={styles.img} resizeMode="cover" />
      </TouchableOpacity>
    );
  }
  if (fullUrl) {
    return (
      <TouchableOpacity onPress={() => handleOpenUrl(fullUrl)}>
        <Text style={styles.link}>Open {String(q?.type || "File").toLowerCase()}</Text>
      </TouchableOpacity>
    );
  }
  if (q?.type === "GEOTAG" && q?.value) {
    return (
      <TouchableOpacity onPress={() => handleOpenUrl(`https://maps.google.com/?q=${q.value}`)}>
        <Text style={styles.link}>{q.value}</Text>
      </TouchableOpacity>
    );
  }
  return <Text style={q?.value ? styles.a : styles.noA}>{q?.value ? String(q.value) : "No response"}</Text>;
}

function generateReportHtml(kind: Kind, contact: MyContact, data: any): string {
  const summary = data?.summary;
  const visits = (data?.tasks ?? []).filter((t: any) => t?.status === "COMPLETED");
  const visitors = (summary?.staff ?? []).filter((s: any) => (s?.completed ?? 0) > 0);
  const profile = data?.profile ?? [];
  const entityLabel = kind === "farmer" ? "Farmer" : "Dealer";

  const locationStr = [contact.village, contact.city, contact.district, contact.state].filter(Boolean).join(", ") || "—";

  const staffRows = visitors.map((s: any) => `
    <tr>
      <td style="font-weight:600;color:#0f172a;padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(s.name || "—")}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(s.phone || "—")}</td>
      <td style="text-align:center;font-weight:700;color:#2563eb;padding:8px 10px;border-bottom:1px solid #e2e8f0;">${s.completed ?? 0}</td>
      <td style="text-align:center;padding:8px 10px;border-bottom:1px solid #e2e8f0;">${mins(s.totalMinutes)}</td>
      <td style="font-size:11px;color:#64748b;padding:8px 10px;border-bottom:1px solid #e2e8f0;">${(s.visitDates || []).map((d: string) => fmt(d, "DD MMM, hh:mm A")).join("<br/>")}</td>
    </tr>
  `).join("");

  const profileRows = profile.map((p: any) => `
    <div style="margin-bottom:10px;padding:10px 14px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;">${escapeHtml(p.question || "")}</div>
      <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:4px;">
        ${p.type === "IMAGE" && p.fileUrl ? `<a href="${toFullUrl(p.fileUrl)}" target="_blank" style="color:#2563eb;text-decoration:underline;">[View Image]</a>` : escapeHtml(p.value || "—")}
      </div>
      <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Recorded by ${escapeHtml(p.answeredBy || "Staff")} on ${fmt(p.answeredAt, "DD MMM YYYY, hh:mm A")}</div>
    </div>
  `).join("");

  const visitRows = visits.map((t: any, idx: number) => {
    const qas = (t.qa || []).map((q: any) => `
      <div style="margin-top:6px;padding:6px 10px;background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;">
        <span style="font-size:11px;font-weight:700;color:#475569;">${escapeHtml(q.question || "")}: </span>
        <span style="font-size:12px;font-weight:500;color:#0f172a;">
          ${q.type === "IMAGE" && q.fileUrl ? `<a href="${toFullUrl(q.fileUrl)}" target="_blank" style="color:#2563eb;">[Photo Attached]</a>` : escapeHtml(q.value || "—")}
        </span>
      </div>
    `).join("");

    return `
      <div style="margin-bottom:16px;padding:14px;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:8px;margin-bottom:8px;">
          <div>
            <span style="font-size:14px;font-weight:800;color:#0f172a;">Visit #${visits.length - idx} &bull; ${escapeHtml(t.assignedTo?.name || "Staff")}</span>
            ${t.durationMin != null ? `<span style="margin-left:8px;font-size:11px;color:#2563eb;font-weight:700;background:#eff6ff;padding:2px 8px;border-radius:12px;">${mins(t.durationMin)}</span>` : ""}
          </div>
          <div style="font-size:12px;font-weight:600;color:#64748b;">
            ${fmt(t.completedAt, "DD MMM YYYY, hh:mm A")}
          </div>
        </div>
        ${t.completionRemarks ? `<div style="font-size:12px;color:#334155;margin-bottom:8px;background:#f8fafc;padding:6px 10px;border-radius:4px;"><strong>Remarks:</strong> ${escapeHtml(t.completionRemarks)}</div>` : ""}
        ${qas ? `<div style="margin-top:6px;"><strong style="font-size:12px;color:#475569;">Discussion & Form Responses:</strong>${qas}</div>` : ""}
      </div>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Visit Report - ${escapeHtml(contact.name)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .meta { font-size: 11px; color: #94a3b8; text-align: right; }
          .badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 6px; }
          .stats-grid { display: flex; gap: 12px; margin-bottom: 20px; }
          .stat-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
          .stat-num { font-size: 18px; font-weight: 800; color: #0f172a; }
          .stat-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px; }
          .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 20px 0 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px; }
          th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px 10px; font-weight: 700; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 10px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="badge">${entityLabel} Visit Report</div>
            <div class="title">${escapeHtml(contact.name)}</div>
            <div class="subtitle">
              ${escapeHtml(locationStr)}
              ${contact.phone ? ` &bull; Tel: ${escapeHtml(contact.phone)}` : ""}
              ${kind === "farmer" && (contact.crop || contact.landSize) ? `<br/>Crop: ${escapeHtml(contact.crop || "—")} | Land: ${escapeHtml(contact.landSize || "—")}` : ""}
            </div>
          </div>
          <div class="meta">
            <div>StaffTrack System</div>
            <div>Generated: ${dayjs().format("DD MMM YYYY, hh:mm A")}</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-num">${summary?.completedVisits ?? 0}</div>
            <div class="stat-label">Total Completed Visits</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">${visitors.length}</div>
            <div class="stat-label">Staff Visitors</div>
          </div>
          <div class="stat-box">
            <div class="stat-num">${fmt(summary?.lastVisit, "DD MMM YYYY")}</div>
            <div class="stat-label">Last Visited</div>
          </div>
        </div>

        <div class="section-title">Staff Visit Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Staff Name</th>
              <th>Phone</th>
              <th style="text-align:center;">Visits</th>
              <th style="text-align:center;">Total Time</th>
              <th>Visit Dates</th>
            </tr>
          </thead>
          <tbody>
            ${staffRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:12px;">No visits recorded yet</td></tr>'}
          </tbody>
        </table>

        ${profile.length ? `
          <div class="section-title">Latest Recorded Profile & Information</div>
          ${profileRows}
        ` : ""}

        <div class="section-title">Detailed Visit History & Discussions</div>
        ${visitRows || '<div style="color:#94a3b8;font-size:12px;">No completed visits recorded yet.</div>'}

        <div class="footer">
          StaffTrack Field Visit Report &bull; Confidential Document &bull; Generated Automatically
        </div>
      </body>
    </html>
  `;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  tabs: { flexDirection: "row", margin: 12, marginBottom: 6, backgroundColor: "#E2E8F0", borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { fontWeight: "700", color: "#64748B" },
  tabTextActive: { color: "#1A202C" },
  search: { marginHorizontal: 12, backgroundColor: "#FFFFFF" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  name: { fontSize: 15, fontWeight: "800", color: "#1A202C" },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  meta: { fontSize: 11, color: "#2563EB", fontWeight: "600", marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 8 },
  badgeNow: { backgroundColor: "#D1FAE5" },
  badgePast: { backgroundColor: "#F1F5F9" },
  badgeText: { fontSize: 10, fontWeight: "800" },
  empty: { textAlign: "center", color: "#94A3B8", marginTop: 40 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF"
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#1A202C" },
  downloadBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0"
  },
  downloadBtn: {
    borderRadius: 8
  },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 10, padding: 10, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "800", color: "#1A202C" },
  statLabel: { fontSize: 10, color: "#64748B", fontWeight: "700", textTransform: "uppercase" },
  section: { fontSize: 13, fontWeight: "800", color: "#1A202C", marginTop: 18, marginBottom: 8, textTransform: "uppercase" },
  qa: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 6 },
  qaSmall: { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0", borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 6 },
  q: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  a: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  noA: { fontSize: 12, fontStyle: "italic", color: "#94A3B8", marginTop: 2 },
  by: { fontSize: 10, color: "#94A3B8", marginTop: 3 },
  link: { fontSize: 13, fontWeight: "700", color: "#2563EB", marginTop: 2 },
  img: { width: 90, height: 90, borderRadius: 8, marginTop: 4 },
  staffRow: { backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginBottom: 6 },
  staffName: { fontSize: 14, fontWeight: "800", color: "#1A202C" },
  visit: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0", borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  remarksBox: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, padding: 8, marginTop: 6 },
  remarksLabel: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  remarks: { fontSize: 13, color: "#334155", marginTop: 2 }
});
