import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as projectService from "../services/project.service";
import * as issueService from "../services/issue.service";
import * as formService from "../services/form.service";
import * as templateService from "../services/template.service";

// Projects
export async function listProjects(req: Request, res: Response) {
  const { search } = req.query;
  const result = await projectService.listProjects(req.user!, search as string);
  sendSuccess(res, result, "Projects fetched");
}

export async function createProject(req: Request, res: Response) {
  const result = await projectService.createProject(req.user!, req.body);
  sendSuccess(res, result, "Project created", 201);
}

export async function updateProject(req: Request, res: Response) {
  const result = await projectService.updateProject(req.user!, req.params.id, req.body);
  sendSuccess(res, result, "Project updated");
}

export async function deleteProject(req: Request, res: Response) {
  await projectService.deleteProject(req.user!, req.params.id);
  sendSuccess(res, null, "Project deleted");
}

// Issues
export async function listIssues(req: Request, res: Response) {
  const result = await issueService.listIssues(req.user!.companyId, req.query);
  sendSuccess(res, result, "Issues fetched");
}

export async function createIssue(req: Request, res: Response) {
  const result = await issueService.createIssue({
    ...req.body,
    reportedById: req.user!.id,
    companyId: req.user!.companyId
  });
  sendSuccess(res, result, "Issue reported", 201);
}

// Forms
export async function listForms(req: Request, res: Response) {
  const { search } = req.query;
  const result = await formService.listForms(req.user!, search as string);
  sendSuccess(res, result, "Forms fetched");
}

export async function createForm(req: Request, res: Response) {
  const result = await formService.createForm(req.user!, req.body);
  sendSuccess(res, result, "Form created", 201);
}

export async function getForm(req: Request, res: Response) {
  const result = await formService.getFormDetails(req.user!, req.params.id);
  sendSuccess(res, result, "Form details fetched");
}

export async function updateForm(req: Request, res: Response) {
  const result = await formService.updateForm(req.user!, req.params.id, req.body);
  sendSuccess(res, result, "Form updated");
}

export async function deleteForm(req: Request, res: Response) {
  await formService.deleteForm(req.user!, req.params.id);
  sendSuccess(res, null, "Form deleted");
}

export async function getFormResponses(req: Request, res: Response) {
  const result = await formService.getFormResponses(req.user!, req.params.id);
  sendSuccess(res, result, "Form responses fetched");
}

export async function submitFormResponse(req: Request, res: Response) {
  const result = await formService.submitFormResponse(req.user!, req.params.id, req.body);
  sendSuccess(res, result, "Response submitted", 201);
}

// Templates
export async function listTemplates(req: Request, res: Response) {
  const { type, search } = req.query;
  const result = await templateService.listTemplates(type as string, search as string);
  sendSuccess(res, result, "Templates fetched");
}
