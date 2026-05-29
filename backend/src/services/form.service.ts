import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../types/auth";
import { prisma } from "../lib/prisma";
import * as notificationService from "./notification.service";

type FormTemplate = {
  category: string;
  name: string;
  fields: Array<{
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
  }>;
};

const DEFAULT_OPERATIONAL_FORMS: FormTemplate[] = [
  {
    name: "Feedback",
    category: "Customer Feedback",
    fields: [
      { label: "Customer Name", type: "text", required: true },
      { label: "Customer Mobile", type: "text", required: true },
      { label: "Business / Outlet Name", type: "text", required: true },
      { label: "Meeting Location", type: "text", required: true },
      { label: "Meeting Type", type: "select", required: true, options: ["Visit", "Call", "Demo", "Complaint", "Follow-up"] },
      { label: "Product / Service Discussed", type: "text", required: true },
      { label: "Overall Feedback", type: "text", required: true },
      { label: "Pain Points / Objections", type: "text" },
      { label: "Competitor Mentioned", type: "text" },
      { label: "Requested Follow-up Date", type: "date" },
      { label: "Photo / Proof", type: "photo" },
      { label: "Next Action", type: "text", required: true }
    ]
  },
  {
    name: "New Customer",
    category: "Lead Capture",
    fields: [
      { label: "Customer Name", type: "text", required: true },
      { label: "Primary Mobile", type: "text", required: true },
      { label: "Alternate Mobile", type: "text" },
      { label: "Email Address", type: "text" },
      { label: "Business / Outlet Name", type: "text", required: true },
      { label: "Business Type", type: "select", required: true, options: ["Retail", "Wholesale", "Distributor", "Restaurant", "Office", "Other"] },
      { label: "Address", type: "text", required: true },
      { label: "City / Area", type: "text", required: true },
      { label: "Pincode", type: "text" },
      { label: "Interested Product", type: "text", required: true },
      { label: "Expected Monthly Requirement", type: "number" },
      { label: "Expected Order Value", type: "number" },
      { label: "Customer Priority", type: "select", required: true, options: ["Hot", "Warm", "Cold"] },
      { label: "Next Follow-up Date", type: "date" },
      { label: "Site / Shop Photo", type: "photo" },
      { label: "Additional Notes", type: "text" }
    ]
  }
];

export async function listForms(user: AuthUser, search?: string, status?: string) {
  await ensureDefaultOperationalForms(user);

  const whereClause: Prisma.FormWhereInput = {
    companyId: user.companyId
  };

  if (search) {
    whereClause.name = { contains: search, mode: "insensitive" };
  }

  if (status && status !== "All") {
    whereClause.status = status === "Saved" ? "Draft" : status;
  }

  return prisma.form.findMany({
    where: whereClause,
    include: {
      fields: {
        orderBy: { id: "asc" }
      },
      _count: { select: { responses: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getFormDetails(user: AuthUser, formId: string) {
  await ensureDefaultOperationalForms(user);

  return prisma.form.findFirst({
    where: {
      id: formId,
      companyId: user.companyId
    },
    include: {
      fields: {
        orderBy: { id: "asc" }
      }
    }
  });
}

export async function createForm(user: AuthUser, data: any) {
  const { fields, ...formData } = data;
  const newForm = await prisma.form.create({
    data: {
      ...formData,
      companyId: user.companyId,
      createdById: user.id,
      fields: {
        create: normalizeFields(fields)
      }
    },
    include: {
      fields: true
    }
  });

  // Notify all employees about the new form if it's published
  if (newForm.status === "Published") {
    try {
      const employees = await prisma.user.findMany({
        where: {
          companyId: user.companyId,
          role: UserRole.EMPLOYEE
        },
        select: { id: true }
      });

      for (const emp of employees) {
        if (emp.id !== user.id) {
          await notificationService.createNotification(
            emp.id,
            "New Form Published",
            `A new form "${newForm.name}" is now available for you to fill.`,
            "FORM_PUBLISHED"
          );
        }
      }
    } catch (err) {
      console.error("[Form Service] Failed to send form publication notifications:", err);
    }
  }

  return newForm;
}

export async function updateForm(user: AuthUser, formId: string, data: any) {
  const { fields, ...formData } = data;

  await prisma.form.update({
    where: {
      id: formId,
      companyId: user.companyId
    },
    data: formData
  });

  if (fields) {
    await prisma.formField.deleteMany({
      where: { formId }
    });

    await prisma.formField.createMany({
      data: normalizeFields(fields).map((field) => ({
        formId,
        ...field
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
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { name: true, createdById: true }
  });

  const response = await prisma.formResponse.create({
    data: {
      formId,
      userId: user.id,
      data: JSON.stringify(data)
    }
  });

  if (form) {
    const notificationTitle = "New Form Response Submitted";
    const notificationMessage = `${user.name} has submitted a response for the form: ${form.name}`;

    try {
      // Notify form creator
      if (form.createdById && form.createdById !== user.id) {
        await notificationService.createNotification(
          form.createdById,
          notificationTitle,
          notificationMessage,
          "FORM_SUBMITTED"
        );
      }

      // Notify manager if manager exists and is different from creator
      if (user.managerId && user.managerId !== user.id && user.managerId !== form.createdById) {
        await notificationService.createNotification(
          user.managerId,
          notificationTitle,
          notificationMessage,
          "FORM_SUBMITTED"
        );
      }
    } catch (err) {
      console.error("[Form Service] Failed to send form response submission notification:", err);
    }
  }

  return response;
}

export async function getFormResponses(user: AuthUser, formId: string) {
  const whereClause: any = {
    formId,
    form: { companyId: user.companyId }
  };

  if (user.role === UserRole.MANAGER) {
    whereClause.user = { managerId: user.id };
  }

  return prisma.formResponse.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, email: true } }
    },
    orderBy: { submittedAt: "desc" }
  });
}

async function ensureDefaultOperationalForms(user: AuthUser) {
  const names = DEFAULT_OPERATIONAL_FORMS.map((form) => form.name);
  const existingForms = await prisma.form.findMany({
    where: {
      companyId: user.companyId,
      name: { in: names }
    },
    include: {
      fields: true,
      _count: { select: { responses: true } }
    }
  });

  const existingByName = new Map(existingForms.map((form) => [form.name, form]));

  for (const template of DEFAULT_OPERATIONAL_FORMS) {
    const existing = existingByName.get(template.name);

    if (!existing) {
      await prisma.form.create({
        data: {
          name: template.name,
          category: template.category,
          status: "Published",
          companyId: user.companyId,
          createdById: user.id,
          fields: {
            create: normalizeFields(template.fields)
          }
        }
      });
      continue;
    }

    const currentLabels = new Set(existing.fields.map((field) => field.label.trim().toLowerCase()));
    const expectedLabels = template.fields.map((field) => field.label.trim().toLowerCase());
    const missingRequiredFields = expectedLabels.some((label) => !currentLabels.has(label));

    if (!missingRequiredFields || existing._count.responses > 0) {
      continue;
    }

    await prisma.$transaction([
      prisma.form.update({
        where: { id: existing.id },
        data: {
          category: existing.category || template.category,
          status: existing.status || "Published"
        }
      }),
      prisma.formField.deleteMany({
        where: { formId: existing.id }
      }),
      prisma.formField.createMany({
        data: normalizeFields(template.fields).map((field) => ({
          formId: existing.id,
          ...field
        }))
      })
    ]);
  }
}

function normalizeFields(fields: Array<{ label: string; type: string; required?: boolean; options?: string[] }> = []) {
  return fields.map((field) => ({
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    options: field.options ? JSON.stringify(field.options) : null
  }));
}
