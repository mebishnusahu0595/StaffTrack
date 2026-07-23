import React, { useState, useMemo } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Linking, Alert, TouchableOpacity } from "react-native";
import { Text, Card, Button, Badge, TextInput, Chip } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchCompanyDocuments, CompanyFile } from "../api";
import { AppIcon } from "../components/AppIcon";
import { API_ORIGIN_URL } from "../config/env";

const CATEGORIES = ["ALL", "General", "Policy", "Notice", "Training", "Form", "Other"];

function getIconName(fileType?: string | null, fileName?: string): { name: string; color: string } {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  if (fileType === "PDF" || ext === "pdf") {
    return { name: "file-pdf-box", color: "#EF4444" };
  }
  if (fileType === "IMAGE" || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    return { name: "file-image-outline", color: "#10B981" };
  }
  if (fileType === "SPREADSHEET" || ["xls", "xlsx", "csv"].includes(ext)) {
    return { name: "file-excel-box", color: "#059669" };
  }
  if (fileType === "DOC" || ["doc", "docx", "txt"].includes(ext)) {
    return { name: "file-word-box", color: "#2563EB" };
  }
  return { name: "file-document-outline", color: "#64748B" };
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function FilesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const filesQuery = useQuery({
    queryKey: ["companyDocuments", search, selectedCategory],
    queryFn: () => fetchCompanyDocuments({ search, category: selectedCategory === "ALL" ? undefined : selectedCategory }),
    refetchInterval: 30000
  });

  const files = filesQuery.data ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await filesQuery.refetch();
    setRefreshing(false);
  };

  const handleOpenFile = (rawUrl: string) => {
    if (!rawUrl) return;
    const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${API_ORIGIN_URL}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
    Linking.openURL(fullUrl).catch(() => {
      Alert.alert("Error", "Could not open file URL.");
    });
  };

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchSearch =
        search.trim() === "" ||
        f.title.toLowerCase().includes(search.toLowerCase()) ||
        f.fileName.toLowerCase().includes(search.toLowerCase()) ||
        (f.description && f.description.toLowerCase().includes(search.toLowerCase()));

      const matchCat = selectedCategory === "ALL" || f.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [files, search, selectedCategory]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0284C7"]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Company Files & Documents
        </Text>
        <Text style={styles.subtitle}>
          View and download notices, policies, forms, and manuals shared by admin
        </Text>
      </View>

      {/* Search Input */}
      <TextInput
        placeholder="Search file title, name..."
        mode="outlined"
        value={search}
        onChangeText={setSearch}
        left={<TextInput.Icon icon="magnify" color="#64748B" />}
        style={styles.searchInput}
        outlineStyle={{ borderRadius: 12, borderColor: "#CBD5E1" }}
      />

      {/* Category Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <Chip
              key={cat}
              selected={isSelected}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.chip, isSelected && styles.selectedChip]}
              textStyle={[styles.chipText, isSelected && styles.selectedChipText]}
            >
              {cat === "ALL" ? "All Files" : cat}
            </Chip>
          );
        })}
      </ScrollView>

      {/* File List */}
      {filesQuery.isLoading ? (
        <Text style={styles.loadingText}>Loading files...</Text>
      ) : filteredFiles.length === 0 ? (
        <Card style={styles.emptyCard} mode="contained">
          <Card.Content style={styles.emptyContent}>
            <AppIcon name="folder-open-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Files Found</Text>
            <Text style={styles.emptySub}>
              {search || selectedCategory !== "ALL"
                ? "No matching documents found for your search filter."
                : "No company documents or files have been uploaded yet."}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        filteredFiles.map((file: CompanyFile) => {
          const iconInfo = getIconName(file.fileType, file.fileName);

          return (
            <Card key={file.id} style={styles.fileCard} mode="contained">
              <Card.Content style={{ padding: 14, gap: 10 }}>
                {/* File Title & Icon */}
                <View style={styles.fileRow}>
                  <View style={[styles.iconContainer, { backgroundColor: `${iconInfo.color}15` }]}>
                    <AppIcon name={iconInfo.name} size={28} color={iconInfo.color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Badge style={styles.catBadge}>{file.category || "General"}</Badge>
                      {file.fileSize ? <Text style={styles.sizeText}>{formatBytes(file.fileSize)}</Text> : null}
                    </View>
                    <Text style={styles.fileTitle}>{file.title}</Text>
                    <Text style={styles.fileNameText} numberOfLines={1}>
                      {file.fileName}
                    </Text>
                  </View>
                </View>

                {file.description ? (
                  <Text style={styles.fileDesc}>{file.description}</Text>
                ) : null}

                {/* Footer Info & Actions */}
                <View style={styles.footerRow}>
                  <Text style={styles.dateText}>
                    {dayjs(file.createdAt).format("DD MMM YYYY")}
                  </Text>

                  <View style={styles.actionButtons}>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => handleOpenFile(file.fileUrl)}
                      style={styles.viewBtn}
                      labelStyle={{ fontSize: 11, fontWeight: "700", color: "#0284C7" }}
                    >
                      View
                    </Button>
                    <Button
                      mode="contained"
                      buttonColor="#0284C7"
                      compact
                      onPress={() => handleOpenFile(file.fileUrl)}
                      style={styles.downloadBtn}
                      labelStyle={{ fontSize: 11, fontWeight: "700" }}
                    >
                      Download
                    </Button>
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 60
  },
  header: {
    gap: 4
  },
  title: {
    fontWeight: "800",
    color: "#0F172A"
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B"
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    fontSize: 13
  },
  categoryRow: {
    gap: 6,
    paddingVertical: 2
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1
  },
  selectedChip: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7"
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569"
  },
  selectedChipText: {
    color: "#FFFFFF"
  },
  loadingText: {
    textAlign: "center",
    color: "#64748B",
    marginTop: 40
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center"
  },
  emptyContent: {
    alignItems: "center"
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    marginTop: 12
  },
  emptySub: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4
  },
  fileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  fileRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  catBadge: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
    fontSize: 9,
    fontWeight: "800"
  },
  sizeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B"
  },
  fileTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A"
  },
  fileNameText: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1
  },
  fileDesc: {
    fontSize: 12,
    color: "#475569",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8
  },
  dateText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600"
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8
  },
  viewBtn: {
    borderColor: "#BAE6FD",
    borderRadius: 8
  },
  downloadBtn: {
    borderRadius: 8
  }
});
