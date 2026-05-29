import { ExpenseCategory, Prisma, UserRole } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { forbidden, notFound } from "../lib/errors";
import { nextDay, startOfDay } from "../lib/date";
import { prisma } from "../lib/prisma";
import { ensureCanAccessUser } from "./access.service";
import * as notificationService from "./notification.service";

interface CreateExpenseInput {
  category: ExpenseCategory;
  amount: number;
  description: string;
  receiptUrl: string;
  date: Date;
}

interface ListExpensesInput {
  userId?: string;
  date?: Date;
}

export async function createExpense(actor: AuthUser, input: CreateExpenseInput) {
  const expense = await prisma.expense.create({
    data: {
      userId: actor.id,
      category: input.category,
      amount: input.amount,
      description: input.description,
      receiptUrl: input.receiptUrl,
      date: startOfDay(input.date)
    }
  });

  if (actor.managerId) {
    try {
      await notificationService.createNotification(
        actor.managerId,
        "New Expense Claim Filed",
        `${actor.name} has submitted an expense claim of ₹${input.amount} for ${input.category.toLowerCase().replace(/_/g, " ")}.`,
        "EXPENSE_FILED"
      );
    } catch (err) {
      console.error("[Expense Service] Failed to send expense notification:", err);
    }
  }

  return expense;
}

export async function listExpenses(actor: AuthUser, input: ListExpensesInput) {
  const where: Prisma.ExpenseWhereInput = await expenseAccessWhere(actor, input.userId);

  if (input.date) {
    const date = startOfDay(input.date);
    where.date = {
      gte: date,
      lt: nextDay(date)
    };
  }

  return prisma.expense.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          companyId: true,
          managerId: true
        }
      }
    },
    orderBy: { date: "desc" }
  });
}

export async function approveExpense(actor: AuthUser, expenseId: string, approved: boolean) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId }
  });

  if (!expense) {
    notFound("Expense not found");
  }

  await ensureCanAccessUser(actor, expense.userId);

  if (actor.role === UserRole.EMPLOYEE) {
    forbidden("Employees cannot approve expenses");
  }

  const updatedExpense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      approved,
      approvedById: actor.id
    }
  });

  // Create notification
  try {
    await notificationService.createNotification(
      expense.userId,
      `Expense ${approved ? "Approved" : "Rejected"}`,
      `Your expense request of ₹${expense.amount} for ${expense.category.toLowerCase().replace(/_/g, " ")} has been ${approved ? "approved" : "rejected"} by ${actor.name}.`,
      "EXPENSE"
    );
  } catch (err) {
    console.error("Failed to send expense notification:", err);
  }

  return updatedExpense;
}

async function expenseAccessWhere(
  actor: AuthUser,
  requestedUserId?: string
): Promise<Prisma.ExpenseWhereInput> {
  if (requestedUserId) {
    await ensureCanAccessUser(actor, requestedUserId);
    return { userId: requestedUserId };
  }

  if (actor.role === UserRole.SUPERADMIN || actor.role === UserRole.ADMIN) {
    return {};
  }

  if (actor.role === UserRole.MANAGER) {
    return {
      user: {
        companyId: actor.companyId,
        managerId: actor.id
      }
    };
  }

  return {
    userId: actor.id
  };
}
