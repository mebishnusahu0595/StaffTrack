import React, { useState } from "react";
import { 
  View, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  ScrollView, 
  Alert,
  Image,
  TouchableOpacity
} from "react-native";
import { 
  Text, 
  Card, 
  Button, 
  Portal, 
  Modal, 
  TextInput, 
  IconButton, 
  Divider,
  ActivityIndicator,
  List,
  RadioButton
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import { useForms } from "../hooks/useForms";
import { fetchFormDetails, uploadPhoto, Form, FormField } from "../api";
import { API_ORIGIN_URL } from "../config/env";
import dayjs from "dayjs";

export function FormsScreen() {
  const { forms, isFetching, refetch, submitResponse, isSubmitting } = useForms();
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);

  const handleOpenForm = async (form: Form) => {
    setSelectedForm({ ...form, fields: form.fields ?? [] });
    setFormData({});
    setIsLoadingForm(true);

    try {
      const details = await fetchFormDetails(form.id);
      setSelectedForm(details);
    } catch (error) {
      Alert.alert("Form load failed", error instanceof Error ? error.message : "Could not load form fields.");
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleCloseForm = () => {
    if (Object.keys(formData).length > 0) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved answers. Are you sure you want to close?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => setSelectedForm(null) }
        ]
      );
    } else {
      setSelectedForm(null);
    }
  };

  const handleInputChange = (label: string, value: any) => {
    setFormData(prev => ({ ...prev, [label]: value }));
  };

  const pickImage = async (label: string) => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7
    });

    if (!result.canceled) {
      setIsUploading(true);
      try {
        const url = await uploadPhoto(result.assets[0]);
        handleInputChange(label, url);
      } catch (error) {
        Alert.alert("Upload Failed", "Could not upload photo. Please try again.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedForm) return;

    // Validate required fields
    for (const field of selectedForm.fields || []) {
      if (field.required && !formData[field.label]) {
        Alert.alert("Required Field", `${field.label} is required.`);
        return;
      }
    }

    try {
      await submitResponse({ formId: selectedForm.id, data: formData });
      Alert.alert("Success", "Form submitted successfully!");
      setSelectedForm(null);
    } catch (error) {
      Alert.alert("Submission Failed", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const renderField = (field: FormField) => {
    const options = parseOptions(field.options);
    const fieldType = field.type.toLowerCase();

    switch (fieldType) {
      case "number":
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && " *"}</Text>
            <TextInput
              mode="outlined"
              keyboardType="numeric"
              value={formData[field.label]}
              onChangeText={val => handleInputChange(field.label, val)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              style={styles.input}
            />
          </View>
        );
      case "select":
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && " *"}</Text>
            <RadioButton.Group 
              onValueChange={val => handleInputChange(field.label, val)} 
              value={formData[field.label]}
            >
              {options.map((opt: string) => (
                <View key={opt} style={styles.radioItem}>
                  <RadioButton.Android value={opt} />
                  <Text>{opt}</Text>
                </View>
              ))}
            </RadioButton.Group>
          </View>
        );
      case "photo":
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && " *"}</Text>
            {formData[field.label] ? (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ 
                    uri: formData[field.label]?.startsWith("http") 
                      ? formData[field.label] 
                      : `${API_ORIGIN_URL}${formData[field.label]}` 
                  }} 
                  style={styles.imagePreview} 
                />
                <IconButton 
                  icon="close-circle" 
                  size={24} 
                  iconColor="red"
                  onPress={() => handleInputChange(field.label, undefined)}
                  style={styles.removeImageBtn}
                />
              </View>
            ) : (
              <Button 
                mode="outlined" 
                onPress={() => pickImage(field.label)} 
                icon="camera"
                loading={isUploading}
                disabled={isUploading}
              >
                Take Photo
              </Button>
            )}
          </View>
        );
      case "date":
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && " *"}</Text>
            <Button mode="outlined" onPress={() => handleInputChange(field.label, dayjs().format("YYYY-MM-DD"))}>
              {formData[field.label] || "Select Date"}
            </Button>
          </View>
        );
      case "text":
      default:
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{field.label}{field.required && " *"}</Text>
            <TextInput
              mode="outlined"
              value={formData[field.label]}
              onChangeText={val => handleInputChange(field.label, val)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              style={styles.input}
              multiline={field.label.toLowerCase().includes('remarks') || field.label.toLowerCase().includes('description')}
            />
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
        <FlatList
        data={forms}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>Surveys & Forms</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>Fill active forms assigned to you</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => void handleOpenForm(item)}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconContainer, { backgroundColor: item.category === 'Operations' ? '#E3F2FD' : '#F1F8E9' }]}>
                  <IconButton icon="file-document-outline" iconColor={item.category === 'Operations' ? '#1976D2' : '#388E3C'} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.formName}>{item.name}</Text>
                  <Text style={styles.formMeta}>{item.category || "General"} • {item._count?.responses || 0} Submissions</Text>
                </View>
              </View>
              <IconButton icon="chevron-right" />
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconButton icon="clipboard-text-outline" size={48} style={{ opacity: 0.2 }} />
            <Text style={styles.emptyText}>No forms available at the moment</Text>
          </View>
        }
      />

      <Portal>
        <Modal
          visible={!!selectedForm}
          onDismiss={handleCloseForm}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{selectedForm?.name}</Text>
              <Text style={styles.modalSubtitle}>{selectedForm?.category}</Text>
            </View>
            <IconButton icon="close" onPress={handleCloseForm} />
          </View>
          <Divider />
          <ScrollView contentContainerStyle={styles.modalBodyContent} style={styles.modalBody}>
            {isLoadingForm ? (
              <View style={styles.loadingFields}>
                <ActivityIndicator color="#1A202C" />
                <Text style={styles.loadingText}>Loading form fields...</Text>
              </View>
            ) : selectedForm?.fields?.length ? (
              selectedForm.fields.map(renderField)
            ) : (
              <Text style={styles.emptyText}>No fields configured for this form.</Text>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
          <Divider />
          <View style={styles.modalFooter}>
            <Button 
              mode="contained" 
              style={styles.submitBtn} 
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || isUploading || isLoadingForm || !selectedForm?.fields?.length}
            >
              Submit Response
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

function parseOptions(options?: string | string[] | null): string[] {
  if (!options) {
    return [];
  }

  if (Array.isArray(options)) {
    return options;
  }

  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return options
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9F8"
  },
  listContent: {
    padding: 20
  },
  header: {
    marginBottom: 24
  },
  title: {
    fontWeight: "900",
    color: "#1A201E"
  },
  subtitle: {
    color: "#66736F",
    marginTop: 4
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    elevation: 0,
    borderWidth: 1,
    borderColor: "#E0E0E0"
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  textContainer: {
    flex: 1
  },
  formName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#24312D"
  },
  formMeta: {
    fontSize: 11,
    color: "#66736F",
    fontWeight: "600",
    marginTop: 2
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100
  },
  emptyText: {
    color: "#66736F",
    fontWeight: "700",
    marginTop: 12
  },
  modalContainer: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 24,
    height: "85%",
    overflow: "hidden"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1A201E"
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#66736F",
    fontWeight: "700",
    textTransform: "uppercase"
  },
  modalBody: {
    flex: 1
  },
  modalBodyContent: {
    padding: 20
  },
  modalFooter: {
    padding: 20,
    backgroundColor: "#F7F9F8"
  },
  fieldContainer: {
    marginBottom: 24
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#24312D",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  input: {
    backgroundColor: "white",
    fontSize: 14
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8
  },
  imagePreviewContainer: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E0E0E0"
  },
  imagePreview: {
    width: "100%",
    height: "100%"
  },
  removeImageBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "rgba(255,255,255,0.8)"
  },
  submitBtn: {
    borderRadius: 16,
    height: 54,
    justifyContent: "center"
  },
  loadingFields: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80
  },
  loadingText: {
    color: "#66736F",
    fontWeight: "700",
    marginTop: 12
  }
});
