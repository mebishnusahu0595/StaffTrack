import { UserRole } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { forbidden, notFound } from "../lib/errors";
import { prisma } from "../lib/prisma";

export interface CreateDealerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
}

export async function listDealers(actor: AuthUser) {
  const dealers = await prisma.dealer.findMany({
    where: actor.role === UserRole.SUPERADMIN ? undefined : { companyId: actor.companyId },
    orderBy: { name: "asc" }
  });

  try {
    const ledgers = await prisma.$queryRawUnsafe<any[]>(
      `SELECT dealer_code, four_digit_id, dealer_name, credit_limit, credit_balance, total_outstanding, total_invoiced, total_paid
       FROM vaniki_dealer_ledgers`
    );

    return dealers.map((d) => {
      const fourDigit = (d.name.match(/\d{4}/) || [""])[0];
      const match = ledgers.find(
        (l) =>
          (l.dealer_code && (l.dealer_code === d.phone || l.dealer_code === d.name)) ||
          (fourDigit && l.four_digit_id === fourDigit)
      );

      return {
        ...d,
        creditLimit: match ? Number(match.credit_limit || 0) : 0,
        creditBalance: match ? Number(match.credit_balance || 0) : 0,
        totalOutstanding: match ? Number(match.total_outstanding || 0) : 0,
        totalInvoiced: match ? Number(match.total_invoiced || 0) : 0,
        totalPaid: match ? Number(match.total_paid || 0) : 0,
      };
    });
  } catch (err) {
    return dealers;
  }
}

export async function getDealer(actor: AuthUser, dealerId: string) {
  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId }
  });

  if (!dealer) {
    notFound("Dealer not found");
  }

  if (actor.role !== UserRole.SUPERADMIN && dealer.companyId !== actor.companyId) {
    forbidden("Access denied to dealer outside your company");
  }

  return dealer;
}

export async function createDealer(actor: AuthUser, input: CreateDealerInput) {
  if (!input.name || !input.name.trim()) {
    throw new Error("Dealer name is required");
  }

  const trimmedName = input.name.trim();
  const trimmedCity = input.city?.trim() || null;

  // Prevent duplicate dealer in the same company
  const existing = await prisma.dealer.findFirst({
    where: {
      companyId: actor.companyId,
      name: { equals: trimmedName, mode: "insensitive" },
      city: trimmedCity ? { equals: trimmedCity, mode: "insensitive" } : undefined
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.dealer.create({
    data: {
      name: trimmedName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      city: trimmedCity,
      state: input.state?.trim() || null,
      pincode: input.pincode?.trim() || null,
      gstin: input.gstin?.trim() || null,
      companyId: actor.companyId,
      assignedUserId: input.assignedUserId || null,
      assignedUserName: input.assignedUserName || null
    }
  });
}

export async function updateDealer(actor: AuthUser, dealerId: string, input: Partial<CreateDealerInput>) {
  const dealer = await getDealer(actor, dealerId);

  return prisma.dealer.update({
    where: { id: dealer.id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      phone: input.phone !== undefined ? input.phone : undefined,
      email: input.email !== undefined ? input.email : undefined,
      address: input.address !== undefined ? input.address : undefined,
      city: input.city !== undefined ? input.city : undefined,
      state: input.state !== undefined ? input.state : undefined,
      pincode: input.pincode !== undefined ? input.pincode : undefined,
      gstin: input.gstin !== undefined ? input.gstin : undefined,
      assignedUserId: input.assignedUserId !== undefined ? input.assignedUserId : undefined,
      assignedUserName: input.assignedUserName !== undefined ? input.assignedUserName : undefined
    }
  });
}

export async function deleteDealer(actor: AuthUser, dealerId: string) {
  const dealer = await getDealer(actor, dealerId);

  return prisma.dealer.delete({
    where: { id: dealer.id }
  });
}

export async function getDealerVisits(actor: AuthUser, dealerId: string) {
  const dealer = await getDealer(actor, dealerId);

  // 1. Fetch completed or assigned tasks for this dealer
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { dealers: { some: { id: dealer.id } } },
        { title: { contains: dealer.name, mode: "insensitive" } },
        { description: { contains: dealer.name, mode: "insensitive" } }
      ]
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true
        }
      }
    },
    orderBy: { dueDate: "desc" },
    take: 50
  });

  // 2. Fetch dealer activities from vaniki_dealer_activities
  let activities: any[] = [];
  const fourDigit = (dealer.name.match(/\d{4}/) || [""])[0];
  try {
    activities = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM vaniki_dealer_activities 
       WHERE LOWER(TRIM(dealer_name)) = LOWER(TRIM($1)) 
          OR dealer_code = $2 
          OR (four_digit_id IS NOT NULL AND four_digit_id != '' AND four_digit_id = $3)
       ORDER BY created_at DESC LIMIT 50`,
      dealer.name,
      dealer.phone || dealer.name,
      fourDigit
    );
  } catch (err) {
    console.error("Error fetching activities in dealer visits:", err);
  }

  // 3. Fetch persistent local ledger
  let ledger = null;
  try {
    const { getOrCreateDealerLedger } = await import("./vaniki-dealer.service");
    ledger = await getOrCreateDealerLedger(dealer.phone || dealer.name, fourDigit, dealer.name);
  } catch (err) {
    console.error("Error fetching ledger in dealer visits:", err);
  }

  return {
    dealer,
    tasks,
    activities,
    ledger
  };
}

