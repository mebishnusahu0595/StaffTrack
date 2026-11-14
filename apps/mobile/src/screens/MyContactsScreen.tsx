import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Image, Linking, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ActivityIndicator, IconButton, Modal, Portal, Text, TextInput } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { appIconSource } from "../components/AppIcon";
import { fetchContactVisits, fetchMyContacts, type MyContact } from "../api";

type Kind = "farmer" | "dealer";

const fmt = (d?: string | null, f = "DD MMM YYYY") => (d ? dayjs(d).format(f) : "—");
const mins = (m?: number | null) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

const CACHE_KEY_CONTACTS = "@stafftrack:myContacts";

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

      <Portal>
        <Modal visible={!!selected} onDismiss={() => setSelected(null)} contentContainerStyle={styles.modal}>
          {selected && <ContactDetail kind={kind} contact={selected} onClose={() => setSelected(null)} />}
        </Modal>
      </Portal>
    </View>
  );
}

function ContactDetail({ kind, contact, onClose }: { kind: Kind; contact: MyContact; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["contactVisits", kind, contact.id],
    queryFn: () => fetchContactVisits(kind, contact.id)
  });
  const summary = data?.summary;
  // only completed tasks count as a visit
  const visits = (data?.tasks ?? []).filter((t: any) => t.status === "COMPLETED");
  const visitors = (summary?.staff ?? []).filter((s: any) => s.completed > 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.modalHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.modalTitle}>{contact.name}</Text>
          <Text style={styles.sub}>
            {[contact.village, contact.city, contact.district].filter(Boolean).join(", ")}
            {contact.phone ? `  •  ${contact.phone}` : ""}
          </Text>
        </View>
        <IconButton icon={appIconSource("close")} onPress={onClose} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : isError ? (
        <Text style={styles.empty}>Could not load details.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
          <View style={styles.statsRow}>
            <Stat label="Visits" value={summary?.completedVisits ?? 0} />
            <Stat label="Staff" value={visitors.length} />
            <Stat label="Last Visit" value={fmt(summary?.lastVisit, "DD MMM")} />
          </View>

          <Text style={styles.section}>What this {kind} does (latest details)</Text>
          {data?.profile?.length ? (
            data.profile.map((p: any, i: number) => (
              <View key={i} style={styles.qa}>
                <Text style={styles.q}>{p.question}</Text>
                <AnswerView q={p} />
                <Text style={styles.by}>by {p.answeredBy} • {fmt(p.answeredAt)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.sub}>No visit form filled yet.</Text>
          )}

          <Text style={styles.section}>Who visited</Text>
          {visitors.map((s: any) => (
            <View key={s.id} style={styles.staffRow}>
              <Text style={styles.staffName}>{s.name}</Text>
              <Text style={styles.sub}>
                {s.completed} visit{s.completed === 1 ? "" : "s"}  •  Time: {mins(s.totalMinutes)}
              </Text>
              {s.visitDates.length > 0 && (
                <Text style={styles.by}>{s.visitDates.map((d: string) => fmt(d, "DD MMM, hh:mm A")).join("  •  ")}</Text>
              )}
            </View>
          ))}

          <Text style={styles.section}>Visit history</Text>
          {visits.map((t: any) => (
            <View key={t.id} style={styles.visit}>
              <Text style={styles.staffName}>
                {t.assignedTo?.name}  <Text style={{ color: t.status === "COMPLETED" ? "#047857" : "#B45309", fontSize: 11 }}>{t.status}</Text>
              </Text>
              <Text style={styles.by}>
                {t.completedAt ? `Done ${fmt(t.completedAt, "DD MMM YYYY, hh:mm A")}` : `Due ${fmt(t.dueDate)}`}
                {t.durationMin != null ? `  •  ${mins(t.durationMin)}` : ""}
              </Text>
              {!!t.completionRemarks && <Text style={styles.remarks}>{t.completionRemarks}</Text>}
              {(t.qa ?? []).map((q: any, i: number) => (
                <View key={i} style={styles.qaSmall}>
                  <Text style={styles.q}>{q.question}</Text>
                  <AnswerView q={q} />
                </View>
              ))}
            </View>
          ))}
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
  if (q.fileUrl && q.type === "IMAGE") {
    return (
      <TouchableOpacity onPress={() => Linking.openURL(q.fileUrl)}>
        <Image source={{ uri: q.fileUrl }} style={styles.img} />
      </TouchableOpacity>
    );
  }
  if (q.fileUrl) {
    return <Text style={styles.link} onPress={() => Linking.openURL(q.fileUrl)}>Open {String(q.type || "file").toLowerCase()}</Text>;
  }
  if (q.type === "GEOTAG" && q.value) {
    return <Text style={styles.link} onPress={() => Linking.openURL(`https://maps.google.com/?q=${q.value}`)}>{q.value}</Text>;
  }
  return <Text style={q.value ? styles.a : styles.noA}>{q.value ? String(q.value) : "No response"}</Text>;
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
  modal: { backgroundColor: "#FFFFFF", margin: 12, borderRadius: 16, height: "90%", overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingTop: 8, borderBottomWidth: 1, borderColor: "#E2E8F0" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1A202C" },
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
  remarks: { fontSize: 12, color: "#334155", marginTop: 4 }
});
