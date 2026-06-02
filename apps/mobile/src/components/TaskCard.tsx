import dayjs from "dayjs";
import { StyleSheet, View, Image } from "react-native";
import { Button, Card, Text, Icon } from "react-native-paper";

import type { Task, TaskStatus } from "../api";
import { API_ORIGIN_URL } from "../config/env";

type TaskCardProps = {
  task: Task;
  disabled?: boolean;
  onPress?: (task: Task) => void;
};

const statusMeta: Record<TaskStatus, { label: string; color: string; textColor: string }> = {
  PENDING: { label: "Pending", color: "#E8F0FE", textColor: "#174EA6" },
  IN_PROGRESS: { label: "In progress", color: "#FFF4CE", textColor: "#7A4D00" },
  COMPLETED: { label: "Completed", color: "#DFF3E6", textColor: "#17633A" },
  CANCELLED: { label: "Cancelled", color: "#FDE7E9", textColor: "#A4262C" }
};

export function TaskCard({ disabled, onPress, task }: TaskCardProps) {
  const meta = statusMeta[task.status];
  const location = getTaskLocation(task);
  const actionLabel = task.status === "PENDING" ? "Start Task" : "Complete Task";

  return (
    <Card mode="elevated" onPress={disabled ? undefined : () => onPress?.(task)} style={styles.card}>
      <Card.Content>
        <View style={styles.headerWrapper}>
          {task.isSubtask && task.parentTask && (
            <View style={styles.subtaskBadge}>
              <Text style={styles.subtaskBadgeText}>↳ Subtask of: {task.parentTask.title}</Text>
            </View>
          )}
          <View style={styles.header}>
            <Text numberOfLines={2} style={styles.title} variant="titleMedium">
              {task.title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
              <Text style={[styles.statusBadgeText, { color: meta.textColor }]}>
                {meta.label.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.metaRow}>
          <Icon source="calendar-clock" size={16} color="#66736F" />
          <Text style={styles.metaText}>Deadline: {dayjs(task.dueDate).format("DD MMM YYYY")}</Text>
        </View>

        {(() => {
          const now = dayjs();
          const due = dayjs(task.dueDate);
          const diffMinutes = due.diff(now, "minute");
          let timeLeftText = "";
          let isOverdue = false;

          if (diffMinutes < 0) {
            isOverdue = true;
            const absMin = Math.abs(diffMinutes);
            if (absMin < 60) {
              timeLeftText = `Overdue by ${absMin} mins`;
            } else if (absMin < 24 * 60) {
              timeLeftText = `Overdue by ${Math.floor(absMin / 60)} hrs`;
            } else {
              timeLeftText = `Overdue by ${Math.floor(absMin / (24 * 60))} days`;
            }
          } else {
            if (diffMinutes < 60) {
              timeLeftText = `${diffMinutes} mins left`;
            } else if (diffMinutes < 24 * 60) {
              const hours = Math.floor(diffMinutes / 60);
              const mins = diffMinutes % 60;
              timeLeftText = `${hours}h ${mins}m left`;
            } else {
              timeLeftText = `${Math.floor(diffMinutes / (24 * 60))} days left`;
            }
          }

          return task.status !== "COMPLETED" && task.status !== "CANCELLED" ? (
            <View style={styles.metaRow}>
              <Icon source="clock-alert-outline" size={16} color={isOverdue ? "#A4262C" : "#D48806"} />
              <Text style={[styles.metaText, { color: isOverdue ? "#A4262C" : "#D48806", fontWeight: "700" }]}>
                Time Left: {timeLeftText}
              </Text>
            </View>
          ) : null;
        })()}

        <View style={styles.badgeRow}>
          <View style={[styles.repeatBadge, !task.isRepeating && { backgroundColor: '#E0E4E7' }]}>
            <Icon 
              source={task.isRepeating ? "repeat-variant" : "calendar-month-outline"} 
              size={12} 
              color={task.isRepeating ? "#1A202C" : "#5F6368"} 
            />
            <Text style={[styles.repeatText, !task.isRepeating && { color: "#5F6368" }]}>
              {task.isRepeating 
                ? (task.repeatFrequency === 'DAILY' ? 'EVERY DAY' : 
                   task.repeatFrequency === 'WEEKLY' ? (task.repeatDays ? `EVERY WEEK (${task.repeatDays.split(',').map((d:any) => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d]).join(',')})` : 'EVERY WEEK') : 
                   task.repeatFrequency === 'MONTHLY' ? (task.repeatDates ? `EVERY MONTH (${task.repeatDates})` : 'EVERY MONTH') : 
                   task.repeatFrequency?.toUpperCase())
                : "NO REPEAT"}
            </Text>
          </View>

          {task.priority && (
            <View style={[styles.priorityBadge, 
              task.priority === 'High' ? styles.priorityHigh : 
              task.priority === 'Medium' ? styles.priorityMedium : styles.priorityLow
            ]}>
              <Text style={styles.priorityText}>{task.priority.toUpperCase()}</Text>
            </View>
          )}

          {typeof task.points === 'number' && (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>{task.points} PTS</Text>
            </View>
          )}
        </View>

        {location && (
          <View style={styles.metaRow}>
            <Icon source="map-check-outline" size={16} color="#66736F" />
            <Text style={styles.metaText}>Location: Verified</Text>
          </View>
        )}

        {task.description ? (
          <Text numberOfLines={3} style={styles.description}>
            {task.description}
          </Text>
        ) : null}

        {task.status === "COMPLETED" && (
          <View style={styles.completionEvidence}>
            <View style={styles.evidenceHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon source="check-decagram-outline" size={14} color="#1A202C" />
                <Text style={styles.evidenceLabel}>COMPLETION PROOF</Text>
              </View>
              {!disabled && (
                <Button 
                  mode="text" 
                  compact 
                  onPress={() => onPress?.(task)} 
                  labelStyle={styles.editButtonLabel}
                >
                  Edit
                </Button>
              )}
            </View>
            
            <View style={styles.evidenceContent}>
              <View style={styles.thumbnailOuter}>
                {task.completionPhotoUrl ? (
                  <View style={styles.thumbnailContainer}>
                    <Image 
                      source={{ uri: task.completionPhotoUrl.startsWith('/') ? `${API_ORIGIN_URL}${task.completionPhotoUrl}` : task.completionPhotoUrl }}
                      style={styles.thumbnailSmall} 
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View style={styles.noPhotoIcon}>
                    <Icon source="image-off-outline" size={24} color="#66736F" />
                  </View>
                )}
              </View>
              <View style={styles.remarksContainer}>
                <View style={{ opacity: 0.5 }}>
                  <Icon source="format-quote-open" size={12} color="#1A202C" />
                </View>
                <Text style={styles.completionRemarks}>
                  {task.completionRemarks || "No remarks provided."}
                </Text>
                <View style={{ alignSelf: 'flex-end' }}>
                  <View style={{ opacity: 0.5 }}>
                    <Icon source="format-quote-close" size={12} color="#1A202C" />
                  </View>
                </View>

                {task.completionLat !== undefined && task.completionLat !== null && (
                  <View style={styles.geotagBadge}>
                    <Icon source="map-marker-radius" size={12} color="#2E7D32" />
                    <Text style={styles.geotagText}>
                      Completed at: {task.completionLat.toFixed(6)}, {task.completionLng?.toFixed(6)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </Card.Content>
      {task.status !== "COMPLETED" && task.status !== "CANCELLED" ? (
        <Card.Actions style={styles.actions}>
          <Button
            disabled={disabled}
            mode="contained-tonal"
            onPress={() => onPress?.(task)}
            style={styles.actionButton}
            contentStyle={{ height: 36 }}
            labelStyle={{ fontSize: 12, fontWeight: "700" }}
          >
            {actionLabel}
          </Button>
        </Card.Actions>
      ) : null}
    </Card>
  );
}

function getTaskLocation(task: Task) {
  if (task.location) {
    return task.location;
  }

  if (typeof task.lat === "number" && typeof task.lng === "number") {
    return { lat: task.lat, lng: task.lng };
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "#FFFFFF"
  },
  headerWrapper: {
    marginBottom: 12
  },
  subtaskBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  subtaskBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB'
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    color: "#24312D",
    fontWeight: "700",
    lineHeight: 22
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 30,
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    textAlign: "center"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4
  },
  metaText: {
    color: "#66736F",
    fontSize: 12,
    fontWeight: "600"
  },
  description: {
    marginTop: 12,
    color: "#3D4945",
    fontSize: 14,
    lineHeight: 20
  },
  actions: {
    paddingHorizontal: 8,
    paddingBottom: 8
  },
  actionButton: {
    borderRadius: 8,
    flex: 1,
    backgroundColor: "#E7F3EF"
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: "#E7F3EF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  repeatText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1A202C',
    textTransform: 'uppercase'
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityHigh: { backgroundColor: '#FDE7E9' },
  priorityMedium: { backgroundColor: '#FDF2D5' },
  priorityLow: { backgroundColor: '#DFF3E6' },
  priorityText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#5F6368',
  },
  pointsBadge: {
    backgroundColor: '#E1F0FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pointsText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#005FB8',
  },
  completionEvidence: {
    marginTop: 16,
    backgroundColor: '#F0F7F4',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7EBE1',
  },
  evidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  evidenceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: 0.5
  },
  editButtonLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A202C',
    marginVertical: 0
  },
  evidenceContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  thumbnailOuter: {
    padding: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  thumbnailContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F7F9F8',
  },
  thumbnailSmall: {
    width: '100%',
    height: '100%'
  },
  noPhotoIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  remarksContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8EDEA',
    minHeight: 70,
  },
  completionRemarks: {
    fontSize: 13,
    color: '#3D4945',
    lineHeight: 18,
    fontWeight: '500',
    marginTop: -4,
  },
  geotagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  geotagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2E7D32',
  }
});
