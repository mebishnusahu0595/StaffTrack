import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchDailyAllowanceStatus, submitDailyAllowance, type DailyAllowanceStatus } from "../api";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DailyAllowanceCardProps {
  onSubmitted?: () => void;
}

export function DailyAllowanceCard({ onSubmitted }: DailyAllowanceCardProps) {
  const [status, setStatus] = useState<DailyAllowanceStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>("");
  const [remark, setRemark] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDailyAllowanceStatus();
      setStatus(data);
      if (data.allowance) {
        setAmount(String(data.allowance.amount));
        setRemark(data.allowance.remark || "");
      }
    } catch (err) {
      console.warn("[DailyAllowanceCard] Failed to load status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid allowance amount in ₹.");
      return;
    }

    try {
      setSubmitting(true);
      await submitDailyAllowance({
        amount: numAmount,
        remark: remark.trim() || undefined
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Alert.alert("Success", "Daily allowance submitted successfully!");
      await loadStatus();
      if (onSubmitted) {
        onSubmitted();
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to submit daily allowance.");
    } finally {
      setSubmitting(false);
    }
  };

  // Only render if staff has traveled > 50km
  if (loading && !status) {
    return null;
  }

  if (!status || !status.thresholdExceeded) {
    return null;
  }

  const isSubmitted = Boolean(status.allowance);

  // If already submitted and collapsed, show sleek shrunken bar
  if (isSubmitted && !isExpanded) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsExpanded(true);
        }}
        style={styles.submittedShrunkenContainer}
      >
        <View style={styles.shrunkenContent}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          </View>
          <Text style={styles.shrunkenText}>
            Daily Allowance Submitted: <Text style={styles.shrunkenHighlight}>₹{status.allowance?.amount}</Text>
            {"  "}<Text style={styles.shrunkenGps}>({status.gpsKm} km GPS)</Text>
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color="#64748B" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="car" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.titleTextGroup}>
            <Text style={styles.cardTitle}>Daily Allowance (50km+ GPS Travel)</Text>
            <Text style={styles.cardSubtitle}>
              You have traveled <Text style={styles.kmHighlight}>{status.gpsKm} km</Text> today
            </Text>
          </View>
        </View>

        {isSubmitted && (
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIsExpanded(false);
            }}
            style={styles.shrinkBtn}
          >
            <Ionicons name="chevron-up" size={18} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.formContent}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Allowance Amount (₹) *</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencyPrefix}>₹</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 350"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Remark (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.remarkInput]}
            placeholder="Add any travel details or notes..."
            placeholderTextColor="#94A3B8"
            value={remark}
            onChangeText={setRemark}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.submitButtonText}>
                {isSubmitted ? "Update Daily Allowance" : "Submit Daily Allowance"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  submittedShrunkenContainer: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1
  },
  shrunkenContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  successBadge: {
    marginRight: 8
  },
  shrunkenText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#065F46",
    flex: 1
  },
  shrunkenHighlight: {
    fontWeight: "800",
    color: "#047857"
  },
  shrunkenGps: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500"
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderColor: "#E2E8F0",
    borderWidth: 1.5,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
    marginBottom: 12
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10
  },
  titleTextGroup: {
    flex: 1
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 2
  },
  kmHighlight: {
    fontWeight: "700",
    color: "#2563EB"
  },
  shrinkBtn: {
    padding: 4
  },
  formContent: {
    gap: 12
  },
  inputGroup: {
    gap: 4
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569"
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginRight: 6
  },
  textInput: {
    flex: 1,
    height: 42,
    fontSize: 14,
    color: "#0F172A"
  },
  remarkInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    height: 42
  },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    height: 44,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4
  },
  submitButtonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  }
});
