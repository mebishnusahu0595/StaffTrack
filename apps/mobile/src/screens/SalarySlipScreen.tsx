import React, { useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Alert } from "react-native";
import { Text, Card, ActivityIndicator, Portal, Modal, IconButton, Divider, Button } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { fetchSalarySlips } from "../api";
import { AppIcon } from "../components/AppIcon";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function SalarySlipScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const slipsQuery = useQuery({
    queryKey: ["mySalarySlips"],
    queryFn: () => fetchSalarySlips()
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await slipsQuery.refetch();
    setRefreshing(false);
  };

  const slips: any[] = slipsQuery.data ?? [];

  const handleDownloadPDF = async (s: any) => {
    try {
      const monthName = MONTHS[s.month];
      const earningItems = s.earnings || [];
      const deductionItems = s.deductions || [];
      
      const totalEarn = earningItems.reduce((sum: number, e: any) => sum + Number(e.calculated ?? e.actual ?? 0), 0);
      const totalActual = earningItems.reduce((sum: number, e: any) => sum + Number(e.actual ?? 0), 0);
      const totalDed = deductionItems.reduce((sum: number, d: any) => sum + Number(d.calculated ?? 0), 0);
      const netPay = Math.round(totalEarn - totalDed);

      const detailRow = (l: string, v: string, l2: string, v2: string) =>
        `<tr><td class="dk">${l}</td><td class="dv">${v || "-"}</td><td class="dk">${l2}</td><td class="dv">${v2 || "-"}</td></tr>`;

      const earnRows = earningItems
        .map(
          (e: any) =>
            `<tr><td>${e.label}</td><td class="amt">${Number(e.actual ?? 0).toLocaleString("en-IN")}</td><td class="amt">${Number(e.calculated ?? e.actual ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`
        )
        .join("");
      const dedRows = deductionItems.length
        ? deductionItems
            .map((d: any) => `<tr><td>${d.label}</td><td class="amt">${Number(d.calculated ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`)
            .join("")
        : `<tr><td>-</td><td class="amt">0.00</td></tr>`;

      const html = `
        <html>
          <head>
            <title>Salary Slip - ${s.user?.name || "Employee"}</title>
            <style>
              * { box-sizing: border-box; }
              body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.4; font-size: 11px; }
              .org { text-align: center; margin-bottom: 4px; }
              .org h1 { margin: 0; font-size: 16px; font-weight: 800; }
              .org .sub { font-size: 11px; color: #475569; margin-top: 2px; }
              .org .period { font-size: 12px; font-weight: 700; margin-top: 6px; }
              .org .code { font-size: 10px; color: #64748b; margin-top: 2px; }
              .sheet { border: 1px solid #1e293b; margin-top: 12px; }
              .details { width: 100%; border-collapse: collapse; }
              .details td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 10px; }
              .details .dk { background: #f1f5f9; font-weight: 700; width: 18%; text-transform: capitalize; }
              .details .dv { width: 32%; }
              .cols { display: flex; border-top: 2px solid #1e293b; }
              .col { flex: 1; }
              .col + .col { border-left: 1px solid #1e293b; }
              .tbl { width: 100%; border-collapse: collapse; }
              .tbl th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; padding: 5px 8px; border-bottom: 1px solid #cbd5e1; text-align: left; }
              .tbl th.amt, .tbl td.amt { text-align: right; }
              .tbl td { padding: 5px 8px; border-bottom: 1px solid #eef2f6; font-size: 11px; }
              .tbl tr.total td { font-weight: 800; border-top: 2px solid #1e293b; background: #f8fafc; }
              .net { border-top: 2px solid #1e293b; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; }
              .net .lbl { font-size: 12px; font-weight: 800; }
              .net .words { font-size: 10px; color: #475569; font-style: italic; }
              .sysnote { text-align: center; margin-top: 14px; font-size: 9px; color: #64748b; letter-spacing: 0.5px; }
            </style>
          </head>
          <body>
            <div class="org">
              <h1>${s.orgName || s.company?.name || "Company"}</h1>
              ${s.orgSubtitle ? `<div class="sub">${s.orgSubtitle}</div>` : ""}
              <div class="period">Salary slip for the month of ${monthName} ${s.year}</div>
              ${s.orgCode ? `<div class="code">${s.orgCode}</div>` : ""}
            </div>

            <div class="sheet">
              <table class="details">
                ${detailRow("Company Code", s.companyCode, "Bank Name", s.bankName)}
                ${detailRow("Employee Name", s.user?.name || "Employee", "Bank A/C No", s.bankAccountNo)}
                ${detailRow("Department Name", s.departmentName, "IFSC Code", s.ifscCode)}
                ${detailRow("Designation", s.designation, "Month Days", s.monthDays != null ? String(s.monthDays) : "")}
                ${detailRow("Division Name", s.divisionName, "Payable Days", s.payableDays != null ? String(s.payableDays) : "")}
                ${detailRow("Trainee Type", s.traineeType, "Aadhaar Number", s.aadhaarNumber)}
              </table>

              <div class="cols">
                <div class="col">
                  <table class="tbl">
                    <thead><tr><th>Earnings</th><th class="amt">Actual</th><th class="amt">Calculated</th></tr></thead>
                    <tbody>
                      ${earnRows}
                      <tr class="total"><td>Total</td><td class="amt">${totalActual.toLocaleString("en-IN")}</td><td class="amt">${totalEarn.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div class="col">
                  <table class="tbl">
                    <thead><tr><th>Deduction</th><th class="amt">Calculated</th></tr></thead>
                    <tbody>
                      ${dedRows}
                      <tr class="total"><td>Total</td><td class="amt">${totalDed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="net">
                <div>
                  <div class="lbl">Total Net Pay Rs.${netPay.toLocaleString("en-IN")}/-</div>
                  ${s.netPayWords ? `<div class="words">( In Words: ${s.netPayWords} )</div>` : ""}
                </div>
              </div>
            </div>

            <div class="sysnote">THIS IS SYSTEM GENERATED DOCUMENT, HENCE SIGNATURE IS NOT REQUIRED.</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Download Salary Slip' });
    } catch (err: any) {
      Alert.alert("Error", "Failed to generate PDF: " + err.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />}
      >
        {slipsQuery.isLoading ? (
          <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
        ) : slips.length === 0 ? (
          <Card style={styles.emptyCard} elevation={0}>
            <Card.Content style={styles.emptyContent}>
              <AppIcon name="file-document-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No salary slips yet.</Text>
              <Text style={styles.emptySubtext}>Your published salary slips will appear here.</Text>
            </Card.Content>
          </Card>
        ) : (
          slips.map((s: any) => (
            <Card key={s.id} style={styles.card} elevation={1} onPress={() => setSelected(s)}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{MONTHS[s.month]} {s.year}</Text>
                    <Text style={styles.cardSub}>{s.orgName || s.company?.name || "Salary Slip"}</Text>
                  </View>
                  <View style={styles.netBadge}>
                    <Text style={styles.netLabel}>NET PAY</Text>
                    <Text style={styles.netVal}>{inr(s.netPay)}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <Portal>
        <Modal visible={Boolean(selected)} onDismiss={() => setSelected(null)} contentContainerStyle={styles.modalContainer}>
          {selected && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orgName}>{selected.orgName || selected.company?.name}</Text>
                  {selected.orgSubtitle ? <Text style={styles.orgSub}>{selected.orgSubtitle}</Text> : null}
                  <Text style={styles.period}>Salary slip for {MONTHS[selected.month]} {selected.year}</Text>
                  {selected.orgCode ? <Text style={styles.orgCode}>{selected.orgCode}</Text> : null}
                </View>
                <IconButton icon={() => <AppIcon name="close" size={24} color="#1A202C" />} onPress={() => setSelected(null)} style={{ margin: 0 }} />
              </View>

              <Divider style={styles.divider} />

              <View style={styles.detailGrid}>
                <Detail label="Company Code" value={selected.companyCode} />
                <Detail label="Bank Name" value={selected.bankName} />
                <Detail label="Bank A/C No" value={selected.bankAccountNo} />
                <Detail label="IFSC Code" value={selected.ifscCode} />
                <Detail label="Department" value={selected.departmentName} />
                <Detail label="Designation" value={selected.designation} />
                <Detail label="Division" value={selected.divisionName} />
                <Detail label="Trainee Type" value={selected.traineeType} />
                <Detail label="Month Days" value={selected.monthDays != null ? String(selected.monthDays) : null} />
                <Detail label="Payable Days" value={selected.payableDays != null ? String(selected.payableDays) : null} />
                <Detail label="Aadhaar Number" value={selected.aadhaarNumber} />
              </View>

              <Text style={styles.sectionTitle}>Earnings</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>Description</Text>
                <Text style={[styles.th, styles.thAmt]}>Actual</Text>
                <Text style={[styles.th, styles.thAmt]}>Calculated</Text>
              </View>
              {(selected.earnings ?? []).map((e: any, i: number) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 2 }]}>{e.label}</Text>
                  <Text style={[styles.td, styles.tdAmt]}>{inr(e.actual ?? 0)}</Text>
                  <Text style={[styles.td, styles.tdAmt]}>{inr(e.calculated ?? e.actual ?? 0)}</Text>
                </View>
              ))}

              {(selected.deductions?.length ?? 0) > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Deductions</Text>
                  {selected.deductions.map((d: any, i: number) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={[styles.td, { flex: 2 }]}>{d.label}</Text>
                      <Text style={[styles.td, styles.tdAmt]}>{inr(d.calculated ?? 0)}</Text>
                    </View>
                  ))}
                </>
              )}

              <View style={styles.netBox}>
                <Text style={styles.netBoxLabel}>Total Net Pay</Text>
                <Text style={styles.netBoxVal}>Rs.{Math.round(selected.netPay).toLocaleString()}/-</Text>
              </View>
              {selected.netPayWords ? <Text style={styles.words}>( In Words: {selected.netPayWords} )</Text> : null}

              <Text style={styles.sysNote}>THIS IS SYSTEM GENERATED DOCUMENT, HENCE SIGNATURE IS NOT REQUIRED.</Text>

              <Button
                mode="contained"
                onPress={() => handleDownloadPDF(selected)}
                style={styles.downloadButton}
                labelStyle={styles.downloadLabel}
              >
                Download PDF
              </Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", marginTop: 20 },
  emptyContent: { alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, fontWeight: "800", color: "#475569", marginTop: 12, textAlign: "center" },
  emptySubtext: { fontSize: 12, color: "#94A3B8", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#EEF2F6" },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#1A202C" },
  cardSub: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  netBadge: { alignItems: "flex-end" },
  netLabel: { fontSize: 8, fontWeight: "800", color: "#94A3B8" },
  netVal: { fontSize: 16, fontWeight: "900", color: "#10B981" },
  modalContainer: { backgroundColor: "#FFFFFF", margin: 16, borderRadius: 20, maxHeight: "90%", elevation: 5 },
  modalContent: { padding: 20 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start" },
  orgName: { fontSize: 18, fontWeight: "900", color: "#1A202C" },
  orgSub: { fontSize: 12, color: "#475569", marginTop: 2 },
  period: { fontSize: 13, fontWeight: "700", color: "#1A202C", marginTop: 6 },
  orgCode: { fontSize: 10, color: "#64748B", marginTop: 2 },
  divider: { marginVertical: 12 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailItem: { minWidth: "46%", flexGrow: 1, backgroundColor: "#F8FAFC", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#EEF2F6" },
  detailLabel: { fontSize: 8, fontWeight: "800", color: "#94A3B8", letterSpacing: 0.4 },
  detailValue: { fontSize: 12, fontWeight: "800", color: "#1A202C", marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: "#1A202C", marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  tableHeader: { flexDirection: "row", backgroundColor: "#F1F5F9", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 },
  th: { fontSize: 9, fontWeight: "800", color: "#64748B", textTransform: "uppercase" },
  thAmt: { flex: 1, textAlign: "right" },
  tableRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: "#EEF2F6" },
  td: { fontSize: 12, color: "#1A202C", fontWeight: "600" },
  tdAmt: { flex: 1, textAlign: "right" },
  netBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0F172A", borderRadius: 12, padding: 14, marginTop: 16 },
  netBoxLabel: { fontSize: 12, fontWeight: "800", color: "#CBD5E1", textTransform: "uppercase" },
  netBoxVal: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" },
  words: { fontSize: 11, color: "#475569", fontStyle: "italic", marginTop: 8, textAlign: "right" },
  sysNote: { fontSize: 9, color: "#94A3B8", textAlign: "center", marginTop: 16, letterSpacing: 0.5 },
  downloadButton: {
    marginTop: 20,
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 4,
    marginBottom: 10,
  },
  downloadLabel: {
    fontWeight: "800",
    color: "#FFFFFF",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
