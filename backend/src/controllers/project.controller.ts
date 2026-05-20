import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../types/auth";

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const projects = await prisma.project.findMany({
      where: { companyId },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    res.json({ success: true, data: projects });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.user!;
    const { name, description, status } = req.body;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        status: status || "Ongoing",
        companyId
      }
    });

    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const project = await prisma.project.update({
      where: { id },
      data: { name, description, status }
    });

    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.project.delete({ where: { id } });
    res.json({ success: true, message: "Project deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
