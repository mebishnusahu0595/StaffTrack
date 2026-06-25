import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, RefreshControl, Dimensions, TouchableOpacity, Image, Alert, Linking } from "react-native";
import { Text, Card, Avatar, ActivityIndicator, IconButton, Portal, Modal, Divider, TextInput, Button, Switch, Chip } from "react-native-paper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchForms, fetchFormResponses, createForm, type Form } from "../../api";
import { AppIcon } from "../../components/AppIcon";
import { API_ORIGIN_URL } from "../../config/env";

export function ManagerFormsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  // Nav/Stack layout of forms: either viewing forms list or viewing submissions of a single form
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);

  // Submission Detail modal zoom state
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);

  // Queries
  const formsQuery = useQuery({
    queryKey: ["managerForms"],
    queryFn: fetchForms
  });

  const responsesQuery = useQuery({
    enabled: Boolean(selectedForm?.id),
    queryKey: ["managerFormResponses", selectedForm?.id],
    queryFn: () => fetchFormResponses(selectedForm!.id)
  });

  // Form Builder State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormCategory, setNewFormCategory] = useState("General Operational");
  const [newFields, setNewFields] = useState<Array<{ label: string; type: "text" | "number" | "select" | "photo" | "date"; required: boolean; options: string[] }>>([]);
  const [optionTextMap, setOptionTextMap] = useState<Record<number, string>>({});

  const queryClient = useQueryClient();

  const createFormMutation = useMutation({
    mutationFn: createForm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerForms"] });
      setCreateModalVisible(false);
      setNewFormName("");
      setNewFormCategory("General Operational");
      setNewFields([]);
      setOptionTextMap({});
      Alert.alert("Success", "Form template published successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to create form template.");
    }
  });

  const addField = () => {
    setNewFields(prev => [...prev, { label: "", type: "text", required: false, options: [] }]);
  };

  const updateField = (index: number, key: string, val: any) => {
    setNewFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: val } : f));
  };

  const removeField = (index: number) => {
    setNewFields(prev => prev.filter((_, i) => i !== index));
    setOptionTextMap(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const addSelectOption = (fieldIndex: number) => {
    const text = (optionTextMap[fieldIndex] || "").trim();
    if (!text) return;
    
    setNewFields(prev => prev.map((f, i) => {
      if (i === fieldIndex) {
        const options = f.options || [];
        if (options.includes(text)) {
          Alert.alert("Error", "This option already exists.");
          return f;
        }
        return { ...f, options: [...options, text] };
      }
      return f;
    }));
    
    setOptionTextMap(prev => ({ ...prev, [fieldIndex]: "" }));
  };

  const removeSelectOption = (fieldIndex: number, optionVal: string) => {
    setNewFields(prev => prev.map((f, i) => i === fieldIndex ? { ...f, options: (f.options || []).filter(o => o !== optionVal) } : f));
  };

  const handleSaveFormTemplate = () => {
    if (!newFormName.trim()) {
      Alert.alert("Error", "Form Name is required.");
      return;
    }
    if (newFields.length === 0) {
      Alert.alert("Error", "Please add at least one field.");
      return;
    }
    const emptyLabel = newFields.some(f => !f.label.trim());
    if (emptyLabel) {
      Alert.alert("Error", "All fields must have a label.");
      return;
    }
    const emptyOptions = newFields.some(f => f.type === "select" && (!f.options || f.options.length === 0));
    if (emptyOptions) {
      Alert.alert("Error", "All Dropdown Selection fields must have at least one choice option.");
      return;
    }

    createFormMutation.mutate({
      name: newFormName.trim(),
      category: newFormCategory.trim() || "General Operational",
      status: "Published",
      fields: newFields.map(f => ({
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        options: f.type === "select" ? f.options : undefined
      }))
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedForm) {
      await responsesQuery.refetch();
    } else {
      await formsQuery.refetch();
    }
    setRefreshing(false);
  };

  const handleBack = () => {
    setSelectedForm(null);
  };

  const formsList = formsQuery.data || [];
  const responsesList = responsesQuery.data || [];

  if (selectedForm) {
    return (
      <View style={styles.container}>
        {/* Sub Header for viewing Form Submissions */}
        <View style={styles.subHeader}>
          <IconButton 
            icon={() => <AppIcon name="chevron-left" size={24} color="#1A202C" />}
            onPress={handleBack} 
            style={styles.backBtn}
          />
          <View style={styles.subHeaderInfo}>
            <Text style={styles.subHeaderTitle}>{selectedForm.name}</Text>
            <Text style={styles.subHeaderLabel}>Team Submissions Log</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />
          }
        >
          {responsesQuery.isLoading ? (
            <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
          ) : responsesList.length === 0 ? (
            <Card style={styles.emptyCard} elevation={0}>
              <Card.Content style={styles.emptyContent}>
                <AppIcon name="file-document-edit-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyText}>No submissions found.</Text>
                <Text style={styles.emptySubtext}>Your team members have not filled out this form yet.</Text>
              </Card.Content>
            </Card>
          ) : (
            responsesList.map((response: any) => {
              // Parse JSON data safe
              let parsedData: any = {};
              try {
                parsedData = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
              } catch {
                parsedData = {};
              }

              const fieldsCount = Object.keys(parsedData).length;

              return (
                <Card 
                  key={response.id} 
                  style={styles.responseCard} 
                  elevation={1}
                  onPress={() => setSelectedResponse({ ...response, parsedData })}
                >
                  <Card.Content>
                    <View style={styles.responseUserRow}>
                      <Avatar.Text 
                        size={32} 
                        label={response.user?.name ? response.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"} 
                        style={styles.avatar}
                        labelStyle={styles.avatarLabel}
                      />
                      <View style={styles.userInfo}>
                        <Text style={styles.responseUserName}>{response.user?.name || "Staff Member"}</Text>
                        <Text style={styles.responseUserTime}>{dayjs(response.submittedAt).format("MMM DD, YYYY • h:mm A")}</Text>
                      </View>
                      <IconButton 
                        icon={() => <AppIcon name="chevron-right" size={18} color="#3B82F6" />}
                        style={{ margin: 0 }}
                      />
                    </View>
                    <Divider style={styles.divider} />
                    <Text style={styles.fieldsSummary}>{fieldsCount} inputs completed by employee</Text>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </ScrollView>

        {/* Dynamic Form Submission Zoom Dialog Portal */}
        <Portal>
          <Modal 
            visible={Boolean(selectedResponse)} 
            onDismiss={() => setSelectedResponse(null)}
            contentContainerStyle={styles.modalContainer}
          >
            {selectedResponse && (
              <ScrollView contentContainerStyle={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Submission Details</Text>
                  <IconButton 
                    icon={() => <AppIcon name="close" size={24} color="#1A202C" />}
                    onPress={() => setSelectedResponse(null)} 
                    style={{ margin: 0 }}
                  />
                </View>

                {/* Sender card */}
                <View style={styles.modalUserCard}>
                  <Avatar.Text 
                    size={38} 
                    label={selectedResponse.user?.name ? selectedResponse.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "S"} 
                    style={styles.avatar}
                    labelStyle={styles.avatarLabel}
                  />
                  <View style={styles.userInfo}>
                    <Text style={styles.modalUserName}>{selectedResponse.user?.name || "Staff Member"}</Text>
                    <Text style={styles.modalUserRole}>Submitted: {dayjs(selectedResponse.submittedAt).format("MMMM D, YYYY • h:mm A")}</Text>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Completed Inputs</Text>
                <View style={styles.inputsList}>
                  {Object.entries(selectedResponse.parsedData).map(([key, val]: [string, any], index) => {
                    const fieldObj = selectedForm.fields?.find((f: any) => f.label === key);
                    const isPhoto = fieldObj?.type === "photo" || (typeof val === "string" && (val.startsWith("/uploads/") || val.endsWith(".jpg") || val.endsWith(".png")));
                    
                    let imageUrl = "";
                    let locationText = "";
                    let hasCoordinates = false;
                    
                    if (isPhoto && val) {
                      imageUrl = typeof val === "object" ? val.url : val;
                      if (typeof val === "object" && val.latitude) {
                        hasCoordinates = true;
                        locationText = `Lat: ${val.latitude.toFixed(6)}, Lng: ${val.longitude.toFixed(6)} | ${dayjs(val.timestamp).format("DD MMM YYYY, hh:mm A")}`;
                      }
                    }

                    const displayVal = typeof val === "boolean" 
                      ? (val ? "Yes" : "No") 
                      : (typeof val === "object" ? (val.url || JSON.stringify(val)) : val?.toString() || "N/A");

                    return (
                      <View key={key} style={[styles.inputItem, index > 0 && styles.inputBorder]}>
                        <Text style={styles.inputKey}>{key}</Text>
                        {isPhoto && imageUrl ? (
                          <View style={{ gap: 8, marginTop: 6 }}>
                            <View style={styles.submissionImageContainer}>
                              <Image 
                                source={{ uri: imageUrl.startsWith("http") ? imageUrl : `${API_ORIGIN_URL}${imageUrl}` }} 
                                style={styles.submissionImage}
                                resizeMode="cover"
                              />
                            </View>
                            {hasCoordinates && val ? (
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" }}>
                                <Text style={{ fontSize: 10, color: "#475569", fontWeight: "700", flex: 1 }}>
                                  📍 {locationText}
                                </Text>
                                <Button 
                                  mode="text" 
                                  compact 
                                  labelStyle={{ fontSize: 9, fontWeight: "900", color: "#3B82F6", margin: 0, padding: 0 }}
                                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${val.latitude},${val.longitude}`)}
                                >
                                  View Map
                                </Button>
                              </View>
                            ) : null}
                          </View>
                        ) : (
                          <Text style={styles.inputVal}>{displayVal}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </Modal>
        </Portal>
      </View>
    );
  }

  // Otherwise, list custom forms
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />
        }
      >
        <Text style={styles.pageTitle}>Custom Templates</Text>
        <Text style={styles.pageSubtitle}>Select a form below to view submissions filled out by your team members.</Text>

        {formsQuery.isLoading ? (
          <ActivityIndicator color="#1A202C" style={{ marginTop: 40 }} />
        ) : formsList.length === 0 ? (
          <Card style={styles.emptyCard} elevation={0}>
            <Card.Content style={styles.emptyContent}>
              <AppIcon name="clipboard-list" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No forms published.</Text>
              <Text style={styles.emptySubtext}>Contact administrator to publish operational forms.</Text>
            </Card.Content>
          </Card>
        ) : (
          formsList.map((form) => {
            const count = form._count?.responses || 0;
            return (
              <Card key={form.id} style={styles.formCard} elevation={1} onPress={() => setSelectedForm(form)}>
                <Card.Content style={styles.formCardContent}>
                  <View style={styles.formIconCircle}>
                    <AppIcon name="file-document-edit-outline" size={24} color="#1A202C" />
                  </View>
                  <View style={styles.formDetails}>
                    <Text style={styles.formName}>{form.name}</Text>
                    <Text style={styles.formCategory}>{form.category || "General Operational"}</Text>
                  </View>
                  <View style={styles.formCountBlock}>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{count}</Text>
                    </View>
                    <Text style={styles.countLabel}>Submissions</Text>
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* FAB Create Button */}
      <TouchableOpacity style={styles.fab} onPress={() => {
        setNewFormName("");
        setNewFormCategory("General Operational");
        setNewFields([{ label: "", type: "text", required: false, options: [] }]);
        setOptionTextMap({});
        setCreateModalVisible(true);
      }}>
        <AppIcon name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Portal Dialog Modal for Form Template Creation */}
      <Portal>
        <Modal 
          visible={createModalVisible} 
          onDismiss={() => setCreateModalVisible(false)}
          contentContainerStyle={styles.createModalContainer}
        >
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Publish Custom Form</Text>
              <IconButton 
                icon={() => <AppIcon name="close" size={24} color="#1A202C" />}
                onPress={() => setCreateModalVisible(false)} 
                style={{ margin: 0 }}
              />
            </View>

            <TextInput
              label="Form Name *"
              value={newFormName}
              onChangeText={setNewFormName}
              mode="outlined"
              activeOutlineColor="#1A202C"
              style={styles.input}
              placeholder="e.g. Daily Site Audit"
            />

            <TextInput
              label="Category / Department"
              value={newFormCategory}
              onChangeText={setNewFormCategory}
              mode="outlined"
              activeOutlineColor="#1A202C"
              style={styles.input}
              placeholder="e.g. Quality Assurance"
            />

            <Divider style={styles.divider} />
            
            <View style={styles.fieldsHeader}>
              <Text style={styles.sectionLabel}>Form Inputs / Fields</Text>
              <Button 
                mode="text" 
                compact 
                icon={() => <AppIcon name="plus" size={14} color="#3B82F6" />} 
                textColor="#3B82F6" 
                onPress={addField}
              >
                Add Field
              </Button>
            </View>

            {newFields.length === 0 ? (
              <Text style={styles.emptyFieldsText}>No fields added yet. Add inputs using the button above.</Text>
            ) : (
              newFields.map((field, idx) => (
                <View key={idx} style={styles.fieldCard}>
                  <View style={styles.fieldCardHeader}>
                    <Text style={styles.fieldIndexLabel}>Input #{idx + 1}</Text>
                    <IconButton 
                      icon={() => <AppIcon name="close" size={16} color="#EF4444" />} 
                      style={{ margin: 0, padding: 0 }}
                      size={16}
                      onPress={() => removeField(idx)}
                    />
                  </View>

                  <TextInput
                    label="Input Label (Question) *"
                    value={field.label}
                    onChangeText={(val) => updateField(idx, "label", val)}
                    mode="outlined"
                    activeOutlineColor="#1A202C"
                    style={styles.fieldInput}
                    placeholder="e.g. Enter Site Pincode"
                  />

                  {/* Input Type selection */}
                  <Text style={styles.fieldLabelLabel}>Input Format Type</Text>
                  <View style={styles.chipsRow}>
                    {(["text", "number", "select", "photo", "date"] as const).map((t) => {
                      const active = field.type === t;
                      const displayNames = {
                        text: "Text",
                        number: "Numeric",
                        select: "Dropdown",
                        photo: "Photo Upload",
                        date: "Date"
                      };
                      return (
                        <Chip
                          key={t}
                          selected={active}
                          onPress={() => updateField(idx, "type", t)}
                          style={[styles.chipItem, active && styles.chipItemActive]}
                          textStyle={[styles.chipText, active && styles.chipTextActive]}
                        >
                          {displayNames[t]}
                        </Chip>
                      );
                    })}
                  </View>

                  {/* Dynamic choices sub-form if type is select */}
                  {field.type === "select" && (
                    <View style={styles.optionsBlock}>
                      <Text style={styles.optionsTitle}>Dropdown Choices / Options *</Text>
                      
                      <View style={styles.optionsList}>
                        {(field.options || []).length === 0 ? (
                          <Text style={styles.noOptionsText}>No choices added yet. Type below and click Add.</Text>
                        ) : (
                          <View style={styles.optionPillsContainer}>
                            {(field.options || []).map((opt) => (
                              <View key={opt} style={styles.optionPill}>
                                <Text style={styles.optionPillText}>{opt}</Text>
                                <TouchableOpacity onPress={() => removeSelectOption(idx, opt)} style={styles.removePillBtn}>
                                  <AppIcon name="close" size={10} color="#64748B" />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      <View style={styles.addOptionRow}>
                        <TextInput
                          label="New Choice Option"
                          value={optionTextMap[idx] || ""}
                          onChangeText={(val) => setOptionTextMap(prev => ({ ...prev, [idx]: val }))}
                          mode="outlined"
                          dense
                          activeOutlineColor="#1A202C"
                          style={styles.optionInput}
                        />
                        <Button 
                          mode="contained" 
                          buttonColor="#1A202C" 
                          textColor="#FFFFFF" 
                          onPress={() => addSelectOption(idx)}
                          style={styles.addOptionBtn}
                        >
                          Add
                        </Button>
                      </View>
                    </View>
                  )}

                  {/* Required Switch */}
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Mandatory Input (Employee must answer)</Text>
                    <Switch
                      value={field.required}
                      onValueChange={(val) => updateField(idx, "required", val)}
                      color="#1A202C"
                    />
                  </View>
                </View>
              ))
            )}

            <View style={styles.modalButtons}>
              <Button mode="text" textColor="#64748B" onPress={() => setCreateModalVisible(false)} style={styles.modalBtn}>
                Cancel
              </Button>
              <Button 
                mode="contained" 
                buttonColor="#1A202C" 
                textColor="#FFFFFF" 
                onPress={handleSaveFormTemplate} 
                loading={createFormMutation.isPending}
                style={styles.modalBtn}
              >
                Publish Form
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1A202C",
    marginTop: 8
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18,
    fontWeight: "500"
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  emptyContent: {
    alignItems: "center",
    justifyContent: "center"
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#475569",
    marginTop: 12,
    textAlign: "center"
  },
  emptySubtext: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center"
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  formCardContent: {
    flexDirection: "row",
    alignItems: "center"
  },
  formIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EEF2F6",
    alignItems: "center",
    justifyContent: "center"
  },
  formDetails: {
    flex: 1,
    marginLeft: 12
  },
  formName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A202C"
  },
  formCategory: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
    fontWeight: "500"
  },
  formCountBlock: {
    alignItems: "center"
  },
  countBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  countText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0284C7"
  },
  countLabel: {
    fontSize: 8,
    color: "#94A3B8",
    fontWeight: "800",
    marginTop: 4,
    textTransform: "uppercase"
  },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0"
  },
  backBtn: {
    margin: 0
  },
  subHeaderInfo: {
    marginLeft: 8
  },
  subHeaderTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1A202C"
  },
  subHeaderLabel: {
    fontSize: 10,
    color: "#3B82F6",
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase"
  },
  responseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  responseUserRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatar: {
    backgroundColor: "#EEF2F6"
  },
  avatarLabel: {
    color: "#475569",
    fontWeight: "700"
  },
  userInfo: {
    flex: 1,
    marginLeft: 10
  },
  responseUserName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A202C"
  },
  responseUserTime: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500"
  },
  divider: {
    backgroundColor: "#EEF2F6",
    marginVertical: 10
  },
  fieldsSummary: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B"
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 20,
    maxHeight: "85%",
    elevation: 5
  },
  modalContent: {
    padding: 20
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1A202C"
  },
  modalUserCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6"
  },
  modalUserName: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1A202C"
  },
  modalUserRole: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600"
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1A202C",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  inputsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden"
  },
  inputItem: {
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  inputBorder: {
    borderTopWidth: 1,
    borderColor: "#F1F5F9"
  },
  inputKey: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase"
  },
  inputVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginTop: 4
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1A202C",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  createModalContainer: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 20,
    maxHeight: "90%",
    elevation: 5
  },
  input: {
    backgroundColor: "#FFFFFF",
    marginBottom: 12
  },
  fieldsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10
  },
  emptyFieldsText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginVertical: 16,
    fontWeight: "500",
    lineHeight: 18
  },
  fieldCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  fieldCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  fieldIndexLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1A202C"
  },
  fieldInput: {
    backgroundColor: "#FFFFFF",
    marginBottom: 12
  },
  fieldLabelLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase"
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12
  },
  chipItem: {
    backgroundColor: "#EEF2F6",
    marginRight: 6,
    marginBottom: 6,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  chipItemActive: {
    backgroundColor: "#1A202C"
  },
  chipText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
    lineHeight: 14
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  optionsBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12
  },
  optionsTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
    textTransform: "uppercase"
  },
  optionsList: {
    marginBottom: 8
  },
  noOptionsText: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 8
  },
  optionPillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  optionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2F6",
    borderRadius: 20,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6
  },
  optionPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginRight: 4
  },
  removePillBtn: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  addOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4
  },
  optionInput: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  addOptionBtn: {
    height: 40,
    justifyContent: "center",
    borderRadius: 8
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6
  },
  switchLabel: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
    flex: 1,
    marginRight: 8
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    gap: 8
  },
  modalBtn: {
    borderRadius: 8
  },
  submissionImageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 8,
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  submissionImage: {
    width: "100%",
    height: "100%"
  }
});
