import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchContactVisits, type Task } from "../api";

/** The dealer/farmer a visit task is linked to, if any. */
function visitContact(task?: Task | null): { kind: "dealer" | "farmer"; id: string } | null {
  if (task?.farmers?.length) return { kind: "farmer", id: task.farmers[0].id };
  if (task?.dealers?.length) return { kind: "dealer", id: task.dealers[0].id };
  return null;
}

/**
 * Under a checklist question: the last answer any staff member gave for this
 * dealer/farmer, who gave it and when. TEXT/DROPDOWN answers can be reused with one tap.
 * Every question calls this, but react-query shares one request per contact.
 */
export function PreviousVisitAnswer({
  task,
  question,
  onUse
}: {
  task?: Task | null;
  question: string;
  onUse?: (value: string) => void;
}) {
  const contact = visitContact(task);
  const { data } = useQuery({
    queryKey: ["contactVisits", contact?.kind, contact?.id],
    queryFn: () => fetchContactVisits(contact!.kind, contact!.id),
    enabled: !!contact,
    staleTime: 5 * 60 * 1000
  });

  const key = question.trim().toLowerCase();
  const prev = (data?.profile as any[] | undefined)?.find((p) => p.question.trim().toLowerCase() === key);
  if (!prev) return null;

  return (
    <View style={styles.box}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>
          Last record • {prev.answeredBy} • {prev.answeredAt ? dayjs(prev.answeredAt).format("DD MMM YYYY") : ""}
        </Text>
        {prev.fileUrl && prev.type === "IMAGE" ? (
          <Image source={{ uri: prev.fileUrl }} style={styles.img} />
        ) : (
          <Text style={styles.value}>{prev.value || "—"}</Text>
        )}
      </View>
      {onUse && prev.value && !prev.fileUrl && prev.type !== "GEOTAG" && (
        <TouchableOpacity onPress={() => onUse(String(prev.value))} style={styles.useBtn}>
          <Text style={styles.useText}>Use</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFBEB", borderColor: "#FDE68A", borderWidth: 1, borderRadius: 10, padding: 8, marginTop: 4, marginBottom: 6 },
  label: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  value: { fontSize: 13, fontWeight: "700", color: "#1A202C", marginTop: 2 },
  img: { width: 60, height: 60, borderRadius: 6, marginTop: 4 },
  useBtn: { backgroundColor: "#F59E0B", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  useText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 }
});
