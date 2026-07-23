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
}

export async function listDealers(actor: AuthUser) {
  if (actor.role === UserRole.SUPERADMIN) {
    return prisma.dealer.findMany({
      orderBy: { createdAt: "desc" }
    });
  }

  return prisma.dealer.findMany({
    where: { companyId: actor.companyId },
    orderBy: { name: "asc" }
  });
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

  return prisma.dealer.create({
    data: {
      name: input.name.trim(),
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      pincode: input.pincode || null,
      gstin: input.gstin || null,
      companyId: actor.companyId
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
      gstin: input.gstin !== undefined ? input.gstin : undefined
    }
  });
}

export async function deleteDealer(actor: AuthUser, dealerId: string) {
  const dealer = await getDealer(actor, dealerId);

  return prisma.dealer.delete({
    where: { id: dealer.id }
  });
}
