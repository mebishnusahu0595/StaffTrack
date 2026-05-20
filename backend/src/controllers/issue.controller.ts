import type { Request, Response } from "express";
import * as issueService from "../services/issue.service";
import { sendSuccess } from "../lib/response";

export async function listIssues(req: Request, res: Response) {
  const result = await issueService.listIssues(req.user!.companyId, req.query);
  sendSuccess(res, result, "Issues fetched");
}

export async function createIssue(req: Request, res: Response) {
  const result = await issueService.createIssue({
    ...req.body,
    companyId: req.user!.companyId,
    reportedById: req.user!.id
  });
  sendSuccess(res, result, "Issue created", 201);
}

export async function getIssue(req: Request, res: Response) {
  const result = await issueService.getIssue(req.params.id);
  sendSuccess(res, result, "Issue details fetched");
}

export async function updateIssue(req: Request, res: Response) {
  const result = await issueService.updateIssue(req.params.id, req.body);
  sendSuccess(res, result, "Issue updated");
}

export async function addIssueUpdate(req: Request, res: Response) {
  const result = await issueService.addIssueUpdate(req.params.id, req.user!.id, req.body);
  sendSuccess(res, result, "Issue update added", 201);
}
