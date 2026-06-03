import { Prisma, TaskStatus, UserRole } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { forbidden } from "../lib/errors";
import { monthRange, startOfDay, nextDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import { getManagerGroupId } from "./access.service";
import { getMonthlyPerformanceReport } from "./report.service";

const memberSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  workMode: true,
  designation: true,
  joiningDate: true,
  avatarUrl: true,
  baseSalary: true,
  travelRate: true,
  managerId: true,
  groupId: true,
  group: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } }
} satisfies Prisma.UserSelect;

/**
 * Returns the set of employees a given actor is allowed to supervise.
 * - MANAGER: their direct reports plus members of their group.
 * - ADMIN / SUPERADMIN: every employee in the company (optionally narrowed to a
 *   single manager's team via `managerId`).
 * - EMPLOYEE: not allowed.
 */
export async function getTeamMembers(actor: AuthUser, managerId?: string) {
  if (actor.role === UserRole.EMPLOYEE) {
    forbidden("Only managers and admins can view team data");
  }

  const where: Prisma.UserWhereInput = {
    companyId: actor.companyId,
    role: UserRole.EMPLOYEE
  };

  if (actor.role === UserRole.MANAGER) {
    const managerGroupId = await getManagerGroupId(actor.id);
    where.OR = [
      { managerId: actor.id },
      ...(managerGroupId ? [{ groupId: managerGroupId }] : [])
    ];
  } else if (managerId) {
    // ADMIN / SUPERADMIN scoping to a specific manager's reports.
    where.managerId = managerId;
  }

  return prisma.user.findMany({
    where,
    select: memberSelect,
    orderBy: { name: "asc" }
  });
}

/**
 * Rich per-member overview for the manager / admin "Team" dashboard.
 * Aggregates attendance, points, km, expenses, tasks and leaves for the month.
 */
export async function getTeamOverview(
  actor: AuthUser,
  options: { month: number; year: number; managerId?: string }
) {
  const { month, year } = options;
  const members = await getTeamMembers(actor, options.managerId);
  const memberIds = members.map((m) => m.id);

  const { start, end } = monthRange(year, month);
  const todayStart = startOfDay(new Date());
  const todayEnd = nextDay(todayStart);

  if (memberIds.length === 0) {
    return { month, year, generatedAt: new Date().toISOString(), members: [] };
  }

  // Batch-load everything for the whole team to avoid N+1 explosions.
  const [expenses, leaves, completedTasks, openTasks] = await Promise.all([
    prisma.expense.findMany({
      where: { userId: { in: memberIds }, date: { gte: start, lt: end } },
      orderBy: { date: "desc" }
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: memberIds },
        startDate: { lt: end },
        endDate: { gte: start }
      },
      include: { approvedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: { in: memberIds },
        status: TaskStatus.COMPLETED,
        updatedAt: { gte: start, lt: end }
      },
      select: {
        id: true,
        title: true,
        status: true,
        points: true,
        dueDate: true,
        updatedAt: true,
        assignedToId: true,
        isSubtask: true,
        parentTaskId: true
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: { in: memberIds },
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] }
      },
      select: {
        id: true,
        title: true,
        status: true,
        points: true,
        dueDate: true,
        assignedToId: true,
        isSubtask: true,
        parentTaskId: true
      },
      orderBy: { dueDate: "asc" }
    })
  ]);

  const byUser = <T extends { assignedToId?: string; userId?: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const key = (row.assignedToId ?? row.userId)!;
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return map;
  };

  const expensesByUser = byUser(expenses);
  const leavesByUser = byUser(leaves);
  const completedByUser = byUser(completedTasks);
  const openByUser = byUser(openTasks);

  const overviews = await Promise.all(
    members.map(async (member) => {
      // Reuse the canonical monthly report for attendance/points/km/payroll.
      let report: Awaited<ReturnType<typeof getMonthlyPerformanceReport>> | null = null;
      try {
        report = await getMonthlyPerformanceReport(actor, member.id, month, year);
      } catch (err) {
        console.error(`[Team] monthly report failed for ${member.id}:`, err);
      }

      const memberExpenses = expensesByUser.get(member.id) ?? [];
      const monthExpense = memberExpenses.reduce((s, e) => s + e.amount, 0);
      const todayExpense = memberExpenses
        .filter((e) => e.date >= todayStart && e.date < todayEnd)
        .reduce((s, e) => s + e.amount, 0);

      const expensesByDay = aggregateByDay(
        memberExpenses.map((e) => ({ date: e.date, value: e.amount }))
      );

      // Pull km per day straight from the day-end reports.
      const memberReports = await prisma.dayEndReport.findMany({
        where: { userId: member.id, date: { gte: start, lt: end } },
        select: { date: true, kmTravelled: true }
      });
      const kmPerDay = aggregateByDay(
        memberReports.map((r) => ({ date: r.date, value: r.kmTravelled }))
      );

      const completed = completedByUser.get(member.id) ?? [];
      const open = openByUser.get(member.id) ?? [];
      const memberLeaves = leavesByUser.get(member.id) ?? [];

      return {
        user: {
          id: member.id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          role: member.role,
          workMode: member.workMode,
          designation: member.designation,
          joiningDate: member.joiningDate,
          avatarUrl: member.avatarUrl,
          department: member.group?.name ?? null,
          groupId: member.groupId,
          managerName: member.manager?.name ?? null
        },
        stats: {
          presentDays: report?.stats.presentDays ?? 0,
          halfDays: report?.stats.halfDays ?? 0,
          absentDays: report?.stats.absentDays ?? 0,
          onLeave: report?.stats.onLeave ?? 0,
          paidHolidays: report?.stats.paidHolidays ?? 0,
          monthlyPoints: report?.stats.monthlyPoints ?? 0,
          totalKm: report?.stats.totalKm ?? 0,
          monthExpense,
          todayExpense,
          completedTasks: completed.length,
          pendingTasks: open.length,
          totalTasks: completed.length + open.length,
          leavesPending: memberLeaves.filter((l) => l.status === "PENDING").length,
          leavesApproved: memberLeaves.filter((l) => l.status === "APPROVED").length
        },
        payroll: report?.payroll ?? null,
        expenses: {
          today: todayExpense,
          month: monthExpense,
          byDay: expensesByDay,
          items: memberExpenses.map((e) => ({
            id: e.id,
            category: e.category,
            amount: e.amount,
            description: e.description,
            date: e.date,
            approved: e.approved
          }))
        },
        travel: { totalKm: report?.stats.totalKm ?? 0, byDay: kmPerDay },
        tasks: {
          pending: open.map(mapTask),
          completed: completed.map(mapTask)
        },
        leaves: memberLeaves.map((l) => ({
          id: l.id,
          startDate: l.startDate,
          endDate: l.endDate,
          reason: l.reason,
          status: l.status,
          approvedByName: l.approvedBy?.name ?? null,
          createdAt: l.createdAt
        })),
        dailyLogs: report?.dailyLogs ?? []
      };
    })
  );

  return {
    month,
    year,
    generatedAt: new Date().toISOString(),
    members: overviews
  };
}

function mapTask(t: {
  id: string;
  title: string;
  status: TaskStatus;
  points: number | null;
  dueDate: Date;
  isSubtask?: boolean;
  parentTaskId?: string | null;
}) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    points: t.points ?? 0,
    dueDate: t.dueDate,
    isSubtask: !!t.isSubtask,
    parentTaskId: t.parentTaskId ?? null
  };
}

function aggregateByDay(rows: Array<{ date: Date; value: number }>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = new Date(row.date).toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + row.value);
  }
  return [...map.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
