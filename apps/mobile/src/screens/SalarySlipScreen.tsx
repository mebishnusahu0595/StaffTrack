import React, { useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl } from "react-native";
import { Text, Card, ActivityIndicator, Portal, Modal, IconButton, Divider } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
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
  sysNote: { fontSize: 9, color: "#94A3B8", textAlign: "center", marginTop: 16, letterSpacing: 0.5 }
});
