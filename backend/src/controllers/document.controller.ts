import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendSuccess } from "../lib/response";

export async function listDocuments(req: Request, res: Response) {
  const { search, category } = req.query;

  const whereClause: any = {};

  if (req.user?.companyId) {
    whereClause.companyId = req.user.companyId;
  }

  if (category && typeof category === "string" && category !== "ALL") {
    whereClause.category = category;
  }

  if (search && typeof search === "string" && search.trim() !== "") {
    const q = search.trim().toLowerCase();
    whereClause.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { fileName: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const files = await prisma.companyFile.findMany({
    where: whereClause,
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  sendSuccess(res, files, "Documents fetched successfully");
}

export async function createDocument(req: Request, res: Response) {
  const { title, description, fileUrl, fileName, fileSize, fileType, mimeType, category } = req.body;

  if (!title || !fileUrl || !fileName) {
    res.status(400).json({ success: false, message: "Title, file URL and file name are required" });
    return;
  }

  let companyId = req.user?.companyId;
  if (!companyId) {
    const firstCompany = await prisma.company.findFirst();
    companyId = firstCompany?.id;
  }

  if (!companyId) {
    res.status(400).json({ success: false, message: "No company found to attach document to" });
    return;
  }

  // Helper to determine fileType if missing
  let derivedType = fileType;
  if (!derivedType) {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["pdf"].includes(ext)) derivedType = "PDF";
    else if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) derivedType = "IMAGE";
    else if (["doc", "docx", "txt", "rtf"].includes(ext)) derivedType = "DOC";
    else if (["xls", "xlsx", "csv"].includes(ext)) derivedType = "SPREADSHEET";
    else if (["mp3", "wav", "m4a", "aac"].includes(ext)) derivedType = "AUDIO";
    else if (["mp4", "mov", "avi", "mkv"].includes(ext)) derivedType = "VIDEO";
    else derivedType = "OTHER";
  }

  const document = await prisma.companyFile.create({
    data: {
      title: title.trim(),
      description: description ? description.trim() : null,
      fileUrl,
      fileName,
      fileSize: fileSize ? Number(fileSize) : null,
      fileType: derivedType,
      mimeType: mimeType || null,
      category: category || "General",
      uploadedById: req.user!.id,
      companyId
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    }
  });

  sendSuccess(res, document, "Document uploaded successfully", 201);
}

export async function deleteDocument(req: Request, res: Response) {
  const { id } = req.params;

  const whereClause: any = { id };
  if (req.user?.companyId) {
    whereClause.companyId = req.user.companyId;
  }

  const existing = await prisma.companyFile.findFirst({
    where: whereClause
  });

  if (!existing) {
    res.status(404).json({ success: false, message: "Document not found" });
    return;
  }

  await prisma.companyFile.delete({
    where: { id }
  });

  sendSuccess(res, null, "Document deleted successfully");
}
