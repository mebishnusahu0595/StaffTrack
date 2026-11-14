import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchTasks, updateTaskStatus, type Task, type TaskStatus } from "../api";

const activeStatuses: TaskStatus[] = ["PENDING", "IN_PROGRESS"];
const TASKS_STORAGE_KEY = "@stafftrack:tasks";

export function useTasks() {
  const queryClient = useQueryClient();
  const [cachedTasks, setCachedTasks] = useState<Task[]>([]);

  // Load cached tasks from AsyncStorage on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
        if (active && raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCachedTasks(parsed);
          }
        }
      } catch (err) {
        console.warn("[useTasks] Error loading cached tasks:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks
  });

  // Sync to AsyncStorage whenever fresh tasks arrive
  useEffect(() => {
    if (Array.isArray(tasksQuery.data) && tasksQuery.data.length > 0) {
      setCachedTasks(tasksQuery.data);
      void AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasksQuery.data));
    }
  }, [tasksQuery.data]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ 
      taskId, 
      status, 
      completionData 
    }: { 
      taskId: string; 
      status: TaskStatus; 
      completionData?: { photoUrl?: string; remarks?: string; lat?: number; lng?: number; checklistResponses?: any; startedAt?: string } 
    }) =>
      updateTaskStatus(taskId, status, completionData),
    onSuccess: (updatedTask, variables) => {
      // Optimistically update cached tasks immediately
      setCachedTasks((prev) => {
        const next = prev.map((t) => (t.id === variables.taskId ? { ...t, status: variables.status, ...variables.completionData } : t));
        void AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // a completed visit is the new "last record" for that dealer/farmer
      void queryClient.invalidateQueries({ queryKey: ["contactVisits"] });
      void queryClient.invalidateQueries({ queryKey: ["myContacts"] });
    }
  });

  const effectiveTasks =
    Array.isArray(tasksQuery.data) && tasksQuery.data.length > 0
      ? tasksQuery.data
      : cachedTasks;

  const activeTasks = useMemo(
    () => effectiveTasks.filter((task) => activeStatuses.includes(task.status)),
    [effectiveTasks]
  );

  const todaysTasks = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toDateString();

    return activeTasks.filter((task) => {
      const dueDate = new Date(task.dueDate);
      const matchesToday = dueDate.toDateString() === todayStr;
      const isOverdue = dueDate < todayStart;

      return matchesToday || isOverdue;
    });
  }, [activeTasks]);

  function advanceTask(task: Task) {
    const status: TaskStatus = task.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED";
    updateStatusMutation.mutate({ taskId: task.id, status });
  }

  return {
    ...tasksQuery,
    activeTasks,
    advanceTask,
    isUpdatingStatus: updateStatusMutation.isPending,
    tasks: effectiveTasks,
    todaysTasks,
    updateStatus: updateStatusMutation.mutateAsync
  };
}
