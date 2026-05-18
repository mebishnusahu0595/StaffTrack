import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, Menu, Text, TextInput, Divider } from "react-native-paper";

import {
  createExpense,
  fetchExpenses,
  uploadExpenseReceipt,
  type ExpenseCategory
} from "../api";

const categories: ExpenseCategory[] = ["TRAVEL", "FOOD", "ACCOMMODATION", "OTHER"];

type ExpenseForm = {
  category: ExpenseCategory;
  amount: string;
  description: string;
  otherDetails?: string;
};

const initialForm: ExpenseForm = {
  category: "TRAVEL",
  amount: "",
  description: ""
};

export function ExpenseScreen() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ExpenseForm>(initialForm);
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const queryKey = ["expenses"];

  const expensesQuery = useQuery({
    queryKey,
    queryFn: () => fetchExpenses()
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!receipt) {
        throw new Error("Attach a receipt photo before submitting.");
      }

      const receiptUrl = await uploadExpenseReceipt(receipt);

      const description = form.description.trim() || formatCategory(form.category);
      const finalDescription = form.category === "OTHER" 
        ? `${form.otherDetails?.trim() || "Other"}: ${description}`
        : description;

      return createExpense({
        category: form.category,
        amount: toNumber(form.amount),
        description: finalDescription,
        receiptUrl,
        date: dayjs().toISOString()
      });
    },
    onSuccess: async () => {
      setForm(initialForm);
      setReceipt(null);
      await queryClient.invalidateQueries({ queryKey });
      Alert.alert("Expense submitted", "Your expense has been sent for approval.");
    },
    onError: (error) => {
      Alert.alert("Submission failed", error instanceof Error ? error.message : "Please try again.");
    }
  });

  async function pickReceipt() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is required to attach a receipt.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7
    });

    if (!result.canceled) {
      setReceipt(result.assets[0]);
    }
  }

  function handleSubmit() {
    if (!form.amount.trim() || !receipt) {
      Alert.alert("Missing details", "Amount and receipt photo are required.");
      return;
    }

    const amount = toNumber(form.amount);
    if (amount <= 0) {
      Alert.alert("Invalid amount", "Amount must be greater than zero.");
      return;
    }

    submitMutation.mutate();
  }

  const expenses = expensesQuery.data ?? [];

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <Text style={styles.title} variant="titleLarge">
            Add expense
          </Text>
          <View style={styles.form}>
            <View style={styles.dropdownContainer}>
              <Text style={styles.label}>Select Category</Text>
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <Button 
                    mode="outlined" 
                    onPress={() => setMenuVisible(true)} 
                    icon="chevron-down"
                    style={styles.dropdownButton}
                    contentStyle={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}
                  >
                    {formatCategory(form.category)}
                  </Button>
                }
              >
                {categories.map((category) => (
                  <Menu.Item 
                    key={category}
                    onPress={() => {
                      setForm((current) => ({ ...current, category }));
                      setMenuVisible(false);
                    }} 
                    title={formatCategory(category)} 
                  />
                ))}
              </Menu>
            </View>

            {form.category === "OTHER" && (
              <TextInput
                label="Specific Details (e.g. Toll, Parking)"
                mode="outlined"
                onChangeText={(otherDetails) => setForm((current) => ({ ...current, otherDetails }))}
                value={form.otherDetails}
                placeholder="What is this expense for?"
              />
            )}
            <TextInput
              keyboardType="decimal-pad"
              label="Amount"
              mode="outlined"
              onChangeText={(amount) => setForm((current) => ({ ...current, amount }))}
              value={form.amount}
            />
            <TextInput
              label="Description"
              mode="outlined"
              onChangeText={(description) => setForm((current) => ({ ...current, description }))}
              value={form.description}
            />
            <Button icon="camera" mode="outlined" onPress={pickReceipt}>
              {receipt ? "Retake photo" : "Click receipt photo"}
            </Button>
            {receipt ? <Image source={{ uri: receipt.uri }} style={styles.preview} /> : null}
            <Button
              disabled={submitMutation.isPending}
              icon="send"
              loading={submitMutation.isPending}
              mode="contained"
              onPress={handleSubmit}
            >
              Submit expense
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Text style={styles.sectionTitle} variant="titleMedium">
        Expense history
      </Text>
      {expenses.length === 0 ? (
        <Text style={styles.emptyText}>No expenses submitted yet.</Text>
      ) : (
        expenses.map((item) => (
          <Card key={item.id} mode="contained" style={styles.historyCard}>
            <Card.Content>
              <View style={styles.historyHeader}>
                <View style={styles.historyCopy}>
                  <Text style={styles.date}>{dayjs(item.date).format("DD MMM YYYY")}</Text>
                  <Text style={styles.amount}>INR {Number(item.amount).toFixed(2)}</Text>
                </View>
                <Chip compact style={item.approved ? styles.approvedChip : styles.pendingChip}>
                  {item.approved ? "Approved" : "Pending"}
                </Chip>
              </View>
              <Text style={styles.description}>
                {formatCategory(item.category)} - {item.description}
              </Text>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function formatCategory(category: ExpenseCategory) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
  form: {
    gap: 12,
    marginTop: 12
  },
  dropdownContainer: {
    marginBottom: 4
  },
  label: {
    fontSize: 12,
    color: "#66736F",
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: "600"
  },
  dropdownButton: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderColor: "#E0E0E0"
  },
  preview: {
    borderRadius: 8,
    height: 180,
    width: "100%"
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
  historyCard: {
    borderRadius: 8,
    marginBottom: 10
  },
  historyHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  historyCopy: {
    flex: 1
  },
  date: {
    color: "#66736F",
    fontSize: 12
  },
  amount: {
    color: "#24312D",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2
  },
  approvedChip: {
    backgroundColor: "#DFF3E6"
  },
  pendingChip: {
    backgroundColor: "#FFF4CE"
  },
  description: {
    color: "#3D4945",
    marginTop: 10
  }
});
