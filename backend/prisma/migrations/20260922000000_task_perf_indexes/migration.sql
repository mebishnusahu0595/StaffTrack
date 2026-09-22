-- Task list/creation queries filter on dueDate/startDate/completedAt ranges and on
-- parentTaskId (subtask include + repeat-series lookups). Without these they were
-- sequential scans on every request.
CREATE INDEX IF NOT EXISTS "Task_parentTaskId_idx" ON "Task"("parentTaskId");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX IF NOT EXISTS "Task_startDate_idx" ON "Task"("startDate");
CREATE INDEX IF NOT EXISTS "Task_completedAt_idx" ON "Task"("completedAt");
CREATE INDEX IF NOT EXISTS "Task_assignedToId_dueDate_idx" ON "Task"("assignedToId", "dueDate");
