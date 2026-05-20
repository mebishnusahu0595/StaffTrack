import { PrismaClient } from "@prisma/client";
import type { AuthUser } from "../types/auth";

const prisma = new PrismaClient();

export async function listForms(user: AuthUser, search?: string) {
  return prisma.form.findMany({
    where: {
      companyId: user.companyId,
      name: search ? { contains: search, mode: "insensitive" } : undefined
    },
    include: {
      _count: { select: { responses: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getFormDetails(user: AuthUser, formId: string) {
  return prisma.form.findUnique({
    where: { 
      id: formId,
      companyId: user.companyId
    },
    include: {
      fields: true
    }
  });
}

export async function createForm(user: AuthUser, data: any) {
  const { fields, ...formData } = data;
  return prisma.form.create({
    data: {
      ...formData,
      companyId: user.companyId,
      createdById: user.id,
      fields: {
        create: fields.map((f: any) => ({
          label: f.label,
          type: f.type,
          required: f.required || false,
          options: f.options ? JSON.stringify(f.options) : null
        }))
      }
    },
    include: {
      fields: true
    }
  });
}

export async function updateForm(user: AuthUser, formId: string, data: any) {
  const { fields, ...formData } = data;
  
  // Update the form itself
  const updatedForm = await prisma.form.update({
    where: { 
      id: formId,
      companyId: user.companyId
    },
    data: formData
  });

  // Handle fields: Simplest way is to delete and recreate if fields were modified
  if (fields) {
    await prisma.formField.deleteMany({
      where: { formId }
    });

    await prisma.formField.createMany({
      data: fields.map((f: any) => ({
        formId,
        label: f.label,
        type: f.type,
        required: f.required || false,
        options: f.options ? JSON.stringify(f.options) : null
      }))
    });
  }

  return getFormDetails(user, formId);
}

export async function deleteForm(user: AuthUser, formId: string) {
  return prisma.form.delete({
    where: { 
      id: formId,
      companyId: user.companyId
    }
  });
}

export async function submitFormResponse(user: AuthUser, formId: string, data: any) {
  return prisma.formResponse.create({
    data: {
      formId,
      userId: user.id,
      data: JSON.stringify(data)
    }
  });
}

export async function getFormResponses(user: AuthUser, formId: string) {
  return prisma.formResponse.findMany({
    where: {
      formId,
      form: { companyId: user.companyId }
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, email: true } }
    },
    orderBy: { submittedAt: "desc" }
  });
}
