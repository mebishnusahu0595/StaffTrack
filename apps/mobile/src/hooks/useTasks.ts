import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchTasks, updateTaskStatus, type Task, type TaskStatus } from "../api";

const activeStatuses: TaskStatus[] = ["PENDING", "IN_PROGRESS"];

export function useTasks() {
  const queryClient = useQueryClient();
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ 
      taskId, 
      status, 
      completionData 
    }: { 
      taskId: string; 
      status: TaskStatus; 
      completionData?: { photoUrl?: string; remarks?: string; lat?: number; lng?: number; checklistResponses?: any } 
    }) =>
      updateTaskStatus(taskId, status, completionData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  });

  const activeTasks = useMemo(
    () => (tasksQuery.data ?? []).filter((task) => activeStatuses.includes(task.status)),
    [tasksQuery.data]
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
    tasks: tasksQuery.data ?? [],
    todaysTasks,
    updateStatus: updateStatusMutation.mutateAsync
  };
}
