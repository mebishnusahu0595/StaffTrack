import { Router } from "express";
import * as projectService from "../services/project.service";
import { AuthRequest } from "../types/auth";
import { roleGuard } from "../middleware/roleGuard";
import { UserRole } from "@prisma/client";

const router = Router();

// Get all projects for company
router.get("/", async (req: AuthRequest, res) => {
  try {
    const search = req.query.search as string;
    const projects = await projectService.listProjects(req.user!.companyId, search);
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch projects" });
  }
});

// Get assigned projects for logged-in employee
router.get("/my-projects", async (req: AuthRequest, res) => {
  try {
    const myProjects = await projectService.getUserProjects(req.user!.id);
    res.json({ success: true, data: myProjects });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch assigned projects" });
  }
});

// Get single project details
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const project = await projectService.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: "Project not found" });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch project details" });
  }
});

// Create project
router.post("/", roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res) => {
  try {
    const { name, targetType, targetQuantity } = req.body;
    if (!name || !targetType || targetQuantity === undefined) {
      return res.status(400).json({ success: false, error: "Name, targetType, and targetQuantity are required" });
    }

    const project = await projectService.createProject(req.user!.companyId, req.body);
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to create project" });
  }
});

// Update period progress (log progress count)
router.patch("/periods/:periodId/progress", async (req: AuthRequest, res) => {
  try {
    const { completedIncrement, completedCount } = req.body;
    const updated = await projectService.updatePeriodProgress(req.params.periodId, {
      completedIncrement: completedIncrement !== undefined ? Number(completedIncrement) : undefined,
      completedCount: completedCount !== undefined ? Number(completedCount) : undefined
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to update period progress" });
  }
});

// Delete project
router.delete("/:id", roleGuard(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res) => {
  try {
    await projectService.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete project" });
  }
});

export default router;
