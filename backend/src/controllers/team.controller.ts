import type { Request, Response } from "express";
import * as teamService from "../services/team.service";
import { sendSuccess } from "../lib/response";

function resolveMonthYear(req: Request) {
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  return { month, year };
}

export async function listTeamMembers(req: Request, res: Response) {
  const managerId = typeof req.query.managerId === "string" ? req.query.managerId : undefined;
  const result = await teamService.getTeamMembers(req.user!, managerId);
  sendSuccess(res, result, "Team members fetched");
}

export async function getTeamOverview(req: Request, res: Response) {
  const { month, year } = resolveMonthYear(req);
  const managerId = typeof req.query.managerId === "string" ? req.query.managerId : undefined;
  const result = await teamService.getTeamOverview(req.user!, { month, year, managerId });
  sendSuccess(res, result, "Team overview fetched");
}
