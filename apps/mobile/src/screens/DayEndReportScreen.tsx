import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { Button, Card, HelperText, List, Text, TextInput, IconButton } from "react-native-paper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import * as ImagePicker from "expo-image-picker";

import { createDayEndReport, fetchDayEndReports, uploadPhoto, DayEndReport } from "../api";
import { useAuth } from "../auth/AuthContext";

type ReportForm = {
  visitsMeetings: string;
  ordersTaken: string;
  ordersCancelled: string;
  startOdometer: string;
  endOdometer: string;
  startOdometerPhotoUrl: string;
  kmPhotoUrl: string;
  remarks: string;
};

const initialForm: ReportForm = {
  visitsMeetings: "",
  ordersTaken: "",
  ordersCancelled: "0",
  startOdometer: "",
  endOdometer: "",
  startOdometerPhotoUrl: "",
  kmPhotoUrl: "",
  remarks: ""
};

export function DayEndReportScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReportForm>(initialForm);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const queryKey = ["dayEndReports", user?.id];

  const historyQuery = useQuery({
    enabled: Boolean(user?.id),
    queryKey,
    queryFn: () => fetchDayEndReports(user!.id)
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      createDayEndReport({
        date: dayjs().toISOString(),
        visitsSummary: form.visitsMeetings.trim(),
        ordersTaken: toNumber(form.ordersTaken),
        ordersCancelled: toNumber(form.ordersCancelled || "0"),
        kmTravelled: toNumber(form.endOdometer) - toNumber(form.startOdometer),
        startOdometer: toNumber(form.startOdometer),
        endOdometer: toNumber(form.endOdometer),
        startOdometerPhotoUrl: form.startOdometerPhotoUrl || undefined,
        kmPhotoUrl: form.kmPhotoUrl || undefined,
        remarks: form.remarks.trim()
      }),
    onSuccess: async () => {
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey });
      Alert.alert("Report submitted", "Your day end report has been saved.");
    },
    onError: (error) => {
      Alert.alert("Submission failed", error instanceof Error ? error.message : "Please try again.");
    }
  });

  const history = historyQuery.data ?? [];
  const alreadySubmittedToday = history.some((report) => dayjs(report.date).isSame(dayjs(), "day"));
  const hasFormError = !form.visitsMeetings.trim() || !form.ordersTaken.trim() || !form.startOdometer.trim() || !form.endOdometer.trim();
  const [isCapturingStart, setIsCapturingStart] = useState(false);
  const [isCapturingEnd, setIsCapturingEnd] = useState(false);

  async function handlePickPhoto(type: 'start' | 'end') {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission denied", "Camera access is needed for odometer verification.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3]
      });

      if (!result.canceled && result.assets[0]) {
        type === 'start' ? setIsCapturingStart(true) : setIsCapturingEnd(true);
        const url = await uploadPhoto(result.assets[0]);
        setForm((prev) => ({ 
          ...prev, 
          [type === 'start' ? 'startOdometerPhotoUrl' : 'kmPhotoUrl']: url 
        }));
      }
    } catch (error) {
      Alert.alert("Photo failed", "Could not capture odometer photo.");
    } finally {
      setIsCapturingStart(false);
      setIsCapturingEnd(false);
    }
  }

  async function handleShare(report: any) {
    setIsSharing(report.id);
    try {
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
              .header { border-bottom: 2px solid #146C5C; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
              .header h1 { color: #146C5C; margin: 0; font-size: 28px; }
              .header p { color: #666; margin: 5px 0 0; font-weight: bold; }
              .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
              .stat-card { background: #f9f9f9; padding: 20px; border-radius: 12px; border: 1px solid #eee; }
              .stat-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 5px; }
              .stat-value { font-size: 20px; color: #222; font-weight: 900; }
              .section { margin-bottom: 30px; }
              .section-title { font-size: 14px; font-weight: bold; color: #146C5C; text-transform: uppercase; border-left: 4px solid #146C5C; padding-left: 10px; margin-bottom: 15px; }
              .content-box { background: #fff; border: 1px solid #eee; padding: 15px; border-radius: 8px; font-size: 14px; line-height: 1.6; }
              .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>DAY END PERFORMANCE REPORT</h1>
              <p>${dayjs(report.date).format("DD MMMM YYYY")}</p>
              <p style="color: #444; font-size: 14px; margin-top: 10px;">Staff: ${user?.name}</p>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Visits / Meetings</div>
                <div class="stat-value">${report.visitsSummary?.split('|')[0] || report.visitsSummary || 0}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Orders Won</div>
                <div class="stat-value">${report.ordersTaken}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Distance Travelled</div>
                <div class="stat-value">${report.kmTravelled || report.totalKmTravelled || 0} KM</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Orders Cancelled</div>
                <div class="stat-value">${report.ordersCancelled || 0}</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Work Summary</div>
              <div class="content-box">${report.visitsSummary}</div>
            </div>

            ${report.remarks ? `
              <div class="section">
                <div class="section-title">Remarks / Directives</div>
                <div class="content-box">${report.remarks}</div>
              </div>
            ` : ''}

            <div class="footer">
              Generated via StaffTrack Engine &bull; ${dayjs().format("DD-MM-YYYY HH:mm")}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert("Sharing failed", "Could not generate or share report.");
    } finally {
      setIsSharing(null);
    }
  }

  function handleSubmit() {
    if (alreadySubmittedToday) {
      return;
    }

    if (hasFormError) {
      Alert.alert("Missing details", "Visits, orders, and both odometer readings are required.");
      return;
    }

    const start = toNumber(form.startOdometer);
    const end = toNumber(form.endOdometer);

    if (end <= start) {
      Alert.alert("Invalid readings", "End odometer reading must be greater than start reading.");
      return;
    }

    if (!form.startOdometerPhotoUrl || !form.kmPhotoUrl) {
      Alert.alert("Photos required", "Please capture photos of both Start and End odometer readings.");
      return;
    }

    submitMutation.mutate();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Card mode="elevated" style={styles.card}>
        <Card.Content>
          <Text style={styles.title} variant="titleLarge">
            Submit today's report
          </Text>
          {alreadySubmittedToday ? (
            <View>
              <Text style={styles.submittedText}>You have already submitted today's report.</Text>
              <Button 
                mode="outlined" 
                icon="share-variant" 
                style={{ marginTop: 12 }}
                onPress={() => handleShare(history.find(r => dayjs(r.date).isSame(dayjs(), "day")))}
              >
                Share Today's Report
              </Button>
            </View>
          ) : (
            <View style={styles.form}>
              <TextInput
                keyboardType="number-pad"
                label="Number of visits/meetings"
                mode="outlined"
                onChangeText={(visitsMeetings) => setForm((current) => ({ ...current, visitsMeetings }))}
                value={form.visitsMeetings}
              />
              <View style={styles.row}>
                <TextInput
                  keyboardType="number-pad"
                  label="Orders taken"
                  mode="outlined"
                  onChangeText={(ordersTaken) => setForm((current) => ({ ...current, ordersTaken }))}
                  style={styles.halfInput}
                  value={form.ordersTaken}
                />
                <TextInput
                  keyboardType="number-pad"
                  label="Cancelled"
                  mode="outlined"
                  onChangeText={(ordersCancelled) => setForm((current) => ({ ...current, ordersCancelled }))}
                  style={styles.halfInput}
                  value={form.ordersCancelled}
                />
              </View>
              <View style={styles.odometerSection}>
                <Text style={styles.subTitle}>Odometer Readings</Text>
                
                <View style={styles.odometerRow}>
                  <View style={styles.odometerCol}>
                    <TextInput
                      keyboardType="number-pad"
                      label="Start Reading"
                      mode="outlined"
                      onChangeText={(startOdometer) => setForm((current) => ({ ...current, startOdometer }))}
                      value={form.startOdometer}
                      style={styles.odometerInput}
                    />
                    <Button
                      icon="camera"
                      loading={isCapturingStart}
                      mode="outlined"
                      onPress={() => handlePickPhoto('start')}
                      style={[styles.smallPhotoButton, form.startOdometerPhotoUrl ? styles.photoCaptured : {}]}
                    >
                      {form.startOdometerPhotoUrl ? "Start ✓" : "Start Photo"}
                    </Button>
                  </View>

                  <View style={styles.odometerCol}>
                    <TextInput
                      keyboardType="number-pad"
                      label="End Reading"
                      mode="outlined"
                      onChangeText={(endOdometer) => setForm((current) => ({ ...current, endOdometer }))}
                      value={form.endOdometer}
                      style={styles.odometerInput}
                    />
                    <Button
                      icon="camera"
                      loading={isCapturingEnd}
                      mode="outlined"
                      onPress={() => handlePickPhoto('end')}
                      style={[styles.smallPhotoButton, form.kmPhotoUrl ? styles.photoCaptured : {}]}
                    >
                      {form.kmPhotoUrl ? "End ✓" : "End Photo"}
                    </Button>
                  </View>
                </View>

                {form.startOdometer && form.endOdometer && (
                  <View style={styles.calculatedKm}>
                    <Text style={styles.kmLabel}>Total KM Travelled:</Text>
                    <Text style={styles.kmValue}>{toNumber(form.endOdometer) - toNumber(form.startOdometer)} KM</Text>
                  </View>
                )}
              </View>

              <TextInput
                label="Remarks"
                mode="outlined"
                multiline
                numberOfLines={4}
                onChangeText={(remarks) => setForm((current) => ({ ...current, remarks }))}
                value={form.remarks}
              />
              <HelperText type="error" visible={hasFormError}>
                All fields and photos are mandatory.
              </HelperText>
              <Button
                disabled={submitMutation.isPending}
                icon="send"
                loading={submitMutation.isPending}
                mode="contained"
                onPress={handleSubmit}
              >
                Submit report
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      <Text style={styles.sectionTitle} variant="titleMedium">
        Previous reports
      </Text>
      {history.length === 0 ? (
        <Text style={styles.emptyText}>No reports submitted yet.</Text>
      ) : (
        history.map((item) => (
          <List.Item
            key={item.id}
            description={`${item.visitsSummary?.split('|')[0] || item.visitsSummary} visits | ${item.kmTravelled ?? item.totalKmTravelled ?? 0} km | Orders: ${item.ordersTaken}`}
            left={(props) => <List.Icon {...props} icon="file-document" />}
            right={(props) => (
              <IconButton 
                {...props} 
                icon="share-variant" 
                onPress={() => handleShare(item)} 
                loading={isSharing === item.id}
              />
            )}
            style={styles.historyItem}
            title={dayjs(item.date).format("DD MMM YYYY")}
          />
        ))
      )}
    </ScrollView>
  );
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
  submittedText: {
    color: "#17633A",
    fontWeight: "700",
    marginTop: 16
  },
  form: {
    gap: 12,
    marginTop: 16
  },
  row: {
    flexDirection: "row",
    gap: 12
  },
  halfInput: {
    flex: 1
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
  historyItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 8
  },
  odometerSection: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12
  },
  odometerRow: {
    flexDirection: 'row',
    gap: 12
  },
  odometerCol: {
    flex: 1,
    gap: 8
  },
  odometerInput: {
    backgroundColor: 'white',
    height: 45
  },
  smallPhotoButton: {
    borderRadius: 8,
    height: 40,
    justifyContent: 'center'
  },
  photoCaptured: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A'
  },
  calculatedKm: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  kmLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B'
  },
  kmValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A'
  }
});
