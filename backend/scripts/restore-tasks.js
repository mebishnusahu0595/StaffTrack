const fs = require("fs");
const readline = require("readline");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runRestore() {
  console.log("Reading backup file from /mnt/backup_hdd/daily_backups/2026-09-16/databases/postgresql_all.sql...");

  const fileStream = fs.createReadStream("/mnt/backup_hdd/daily_backups/2026-09-16/databases/postgresql_all.sql");
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inTask = false;
  let headers = [];
  const rows = [];

  for await (const line of rl) {
    if (line.startsWith("COPY public.\"Task\"")) {
      inTask = true;
      const match = line.match(/\((.+)\)/);
      if (match) {
        headers = match[1].split(", ").map(h => h.replace(/"/g, ""));
      }
      continue;
    }
    if (inTask) {
      if (line === "\\.") {
        inTask = false;
        continue;
      }
      const parts = line.split("\t");
      if (parts.length === headers.length) {
        const obj = {};
        headers.forEach((h, i) => {
          let val = parts[i];
          if (val === "\\N") val = null;
          obj[h] = val;
        });
        rows.push(obj);
      }
    }
  }

  console.log(`Parsed ${rows.length} tasks from backup dump.`);

  // Get all existing task IDs in current DB so we don't overwrite newly created tasks
  const existingTasks = await prisma.task.findMany({ select: { id: true } });
  const existingIds = new Set(existingTasks.map(t => t.id));
  console.log(`Current DB has ${existingIds.size} tasks.`);

  const toInsert = rows.filter(r => !existingIds.has(r.id));
  console.log(`Tasks to restore: ${toInsert.length}`);

  // Step 1: Insert all tasks with parentTaskId = null to avoid foreign key errors
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < toInsert.length; i += batchSize) {
    const chunk = toInsert.slice(i, i + batchSize);
    
    const data = chunk.map(r => {
      let checklist = undefined;
      if (r.checklist) {
        try { checklist = JSON.parse(r.checklist); } catch (e) {}
      }
      let checklistResponses = undefined;
      if (r.checklistResponses) {
        try { checklistResponses = JSON.parse(r.checklistResponses); } catch (e) {}
      }
      let validations = undefined;
      if (r.validations) {
        try { validations = JSON.parse(r.validations); } catch (e) {}
      }

      return {
        id: r.id,
        title: r.title || "Task",
        description: r.description,
        status: r.status || "PENDING",
        assignedToId: r.assignedToId,
        assignedById: r.assignedById,
        dueDate: r.dueDate ? new Date(r.dueDate) : new Date(),
        lat: r.lat ? parseFloat(r.lat) : null,
        lng: r.lng ? parseFloat(r.lng) : null,
        isRepeating: r.isRepeating === "t",
        repeatFrequency: r.repeatFrequency,
        repeatDays: r.repeatDays || null,
        repeatDates: r.repeatDates || null,
        skipHolidays: r.skipHolidays === "t",
        completionPhotoUrl: r.completionPhotoUrl,
        completionRemarks: r.completionRemarks,
        projectId: r.projectId,
        priority: r.priority || "Medium",
        points: r.points ? parseInt(r.points, 10) : 10,
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        parentTaskId: null, // inserted as null in pass 1
        completionLat: r.completionLat ? parseFloat(r.completionLat) : null,
        completionLng: r.completionLng ? parseFloat(r.completionLng) : null,
        attachmentName: r.attachmentName,
        attachmentUrl: r.attachmentUrl,
        checklist: checklist,
        checklistResponses: checklistResponses,
        endDate: r.endDate ? new Date(r.endDate) : null,
        geofenceLat: r.geofenceLat ? parseFloat(r.geofenceLat) : null,
        geofenceLng: r.geofenceLng ? parseFloat(r.geofenceLng) : null,
        geofenceRadius: r.geofenceRadius ? parseFloat(r.geofenceRadius) : null,
        isSubtask: r.isSubtask === "t",
        reminder: r.reminder ? parseInt(r.reminder, 10) : null,
        startDate: r.startDate ? new Date(r.startDate) : null,
        validations: validations,
        templateId: r.templateId,
        completedAt: r.completedAt ? new Date(r.completedAt) : null,
        taskType: r.taskType || "NORMAL"
      };
    });

    await prisma.task.createMany({
      data,
      skipDuplicates: true
    });

    inserted += chunk.length;
    if (inserted % 5000 === 0 || inserted === toInsert.length) {
      console.log(`Pass 1 Progress: ${inserted} / ${toInsert.length} tasks inserted...`);
    }
  }

  // Step 2: Update parentTaskId in batches using raw SQL
  console.log("Pass 2: Updating parentTaskId links...");
  const withParent = toInsert.filter(r => r.parentTaskId);
  console.log(`Tasks with parentTaskId: ${withParent.length}`);

  for (let i = 0; i < withParent.length; i += 500) {
    const chunk = withParent.slice(i, i + 500);
    const updates = chunk.map(r => 
      prisma.$executeRawUnsafe(
        `UPDATE "Task" SET "parentTaskId" = $1 WHERE "id" = $2`,
        r.parentTaskId,
        r.id
      ).catch(() => null)
    );
    await Promise.all(updates);
    if ((i + 500) % 5000 === 0 || i + chunk.length === withParent.length) {
      console.log(`Pass 2 Progress: ${Math.min(i + 500, withParent.length)} / ${withParent.length} parent links updated...`);
    }
  }

  const finalCount = await prisma.task.count();
  console.log(`SUCCESS: Finished restoring tasks. Total tasks in DB is now: ${finalCount}`);
}

runRestore()
  .catch(err => console.error("Restore error:", err))
  .finally(() => prisma.$disconnect());
