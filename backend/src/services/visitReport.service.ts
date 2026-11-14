import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

type QA = { question: string; type: string; value: string | null; fileUrl: string | null };

/**
 * Pair the questions the admin put on the task (task.checklist) with what the staff
 * answered (task.checklistResponses). Handles the array format the mobile app sends
 * and the older { [id]: {text, image, ...} } object format.
 */
export function taskQA(checklist: unknown, responses: unknown): QA[] {
  const items = Array.isArray(checklist) ? (checklist as any[]) : [];
  const answers: any[] = Array.isArray(responses)
    ? (responses as any[])
    : responses && typeof responses === "object"
      ? Object.entries(responses as Record<string, any>).map(([id, v]) => ({
          id,
          value: typeof v === "object" ? v?.text ?? v?.dropdown ?? v?.value ?? null : String(v),
          fileUrl: typeof v === "object" ? v?.image ?? v?.video ?? v?.audio ?? v?.file?.url ?? null : null,
          type: v?.image ? "IMAGE" : "TEXT"
        }))
      : [];

  const out: QA[] = [];
  const used = new Set<any>();
  for (const item of items) {
    const matches = answers.filter((a) => a.id === item.id);
    matches.forEach((m) => used.add(m));
    if (!matches.length) {
      out.push({ question: item.title || item.id, type: item.validations?.[0] || "TEXT", value: null, fileUrl: null });
    }
    for (const m of matches) {
      out.push({ question: item.title || m.title || item.id, type: m.type || "TEXT", value: m.value ?? null, fileUrl: m.fileUrl ?? null });
    }
  }
  // Answers whose question isn't on the checklist any more (edited task, legacy data).
  for (const a of answers) {
    if (used.has(a)) continue;
    out.push({ question: a.title || a.question || a.id, type: a.type || "TEXT", value: a.value ?? null, fileUrl: a.fileUrl ?? null });
  }
  return out;
}

/**
 * Visit report for one dealer/farmer: every visit task (all staff), per-staff summary,
 * and a "profile" = latest answer to each question, so the next staff member sent
 * there knows what this dealer/farmer does.
 */
export async function buildVisitReport(companyId: string, link: Prisma.TaskWhereInput, name: string) {
  const byName: Prisma.TaskWhereInput[] =
    name.trim().length >= 3
      ? [{ title: { contains: name.trim(), mode: "insensitive" }, dealers: { none: {} }, farmers: { none: {} } }]
      : [];

  const tasks = await prisma.task.findMany({
    where: {
      assignedTo: { companyId },
      status: { not: "CANCELLED" },
      // ponytail: name match catches old tasks created without a dealer/farmer link
      OR: [link, ...byName],
      // hide pre-generated future occurrences of repeating tasks
      AND: [{ OR: [{ status: "COMPLETED" }, { dueDate: { lte: new Date(Date.now() + 86400000) } }] }]
    },
    select: {
      id: true,
      title: true,
      status: true,
      taskType: true,
      dueDate: true,
      startedAt: true,
      completedAt: true,
      completionRemarks: true,
      completionPhotoUrl: true,
      completionLat: true,
      completionLng: true,
      checklist: true,
      checklistResponses: true,
      assignedTo: { select: { id: true, name: true, phone: true, email: true, role: true } }
    },
    orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { dueDate: "desc" }],
    take: 200
  });

  const visits = tasks.map((t) => ({
    ...t,
    durationMin:
      t.startedAt && t.completedAt
        ? Math.max(0, Math.round((t.completedAt.getTime() - t.startedAt.getTime()) / 60000))
        : null,
    qa: taskQA(t.checklist, t.checklistResponses)
  }));

  const staff = new Map<string, any>();
  const profile = new Map<string, any>();
  for (const v of visits) {
    const s =
      staff.get(v.assignedTo.id) ??
      { id: v.assignedTo.id, name: v.assignedTo.name, phone: v.assignedTo.phone, assigned: 0, completed: 0, totalMinutes: 0, lastVisit: null, visitDates: [] };
    staff.set(v.assignedTo.id, s);
    s.assigned++;
    if (v.status !== "COMPLETED") continue;
    s.completed++;
    s.totalMinutes += v.durationMin ?? 0;
    if (v.completedAt) {
      s.visitDates.push(v.completedAt);
      if (!s.lastVisit || v.completedAt > s.lastVisit) s.lastVisit = v.completedAt;
    }
    // visits are newest-first, so the first answer seen per question is the latest one
    for (const q of v.qa) {
      const key = q.question.trim().toLowerCase();
      if ((q.value || q.fileUrl) && !profile.has(key)) {
        profile.set(key, { ...q, answeredBy: v.assignedTo.name, answeredAt: v.completedAt });
      }
    }
  }

  const completed = visits.filter((v) => v.status === "COMPLETED");
  return {
    tasks: visits,
    profile: [...profile.values()],
    summary: {
      totalTasks: visits.length,
      completedVisits: completed.length,
      pendingVisits: visits.length - completed.length,
      staffCount: staff.size,
      firstVisit: completed.length ? completed[completed.length - 1].completedAt : null,
      lastVisit: completed[0]?.completedAt ?? null,
      staff: [...staff.values()].sort((a, b) => b.completed - a.completed)
    }
  };
}

/**
 * Dealers & farmers this staff member has actually visited — i.e. has a COMPLETED
 * visit task for. Assigned-but-not-done ones don't count as a visit.
 */
export async function getMyContacts(companyId: string, userId: string) {
  const mine = { status: "COMPLETED" as const, assignedToId: userId };
  const select = {
    assignedUserId: true,
    tasks: { where: mine, select: { completedAt: true }, orderBy: { completedAt: "desc" as const } },
    _count: { select: { tasks: { where: { status: "COMPLETED" as const } } } }
  };

  const [dealers, farmers] = await Promise.all([
    prisma.dealer.findMany({
      where: { companyId, tasks: { some: mine } },
      select: { id: true, name: true, phone: true, address: true, city: true, state: true, ...select },
      orderBy: { name: "asc" }
    }),
    prisma.farmer.findMany({
      where: { companyId, tasks: { some: mine } },
      select: { id: true, name: true, phone: true, village: true, district: true, city: true, crop: true, landSize: true, ...select },
      orderBy: { name: "asc" }
    })
  ]);

  const shape = ({ tasks, _count, ...rest }: any) => ({
    ...rest,
    isCurrentlyAssigned: rest.assignedUserId === userId,
    myVisitCount: tasks.length,
    myVisitDates: tasks.map((t: any) => t.completedAt),
    myLastVisitAt: tasks[0]?.completedAt ?? null,
    totalVisitCount: _count.tasks
  });
  return { dealers: dealers.map(shape), farmers: farmers.map(shape) };
}
