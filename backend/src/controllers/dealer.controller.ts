import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as dealerService from "../services/dealer.service";

export async function listDealers(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const dealers = await dealerService.listDealers(actor);
  sendSuccess(res, dealers, "Dealers fetched");
}

export async function getDealer(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const dealer = await dealerService.getDealer(actor, req.params.id);
  sendSuccess(res, dealer, "Dealer fetched");
}

export async function createDealer(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const dealer = await dealerService.createDealer(actor, req.body);
  sendSuccess(res, dealer, "Dealer created", 201);
}

export async function updateDealer(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const dealer = await dealerService.updateDealer(actor, req.params.id, req.body);
  sendSuccess(res, dealer, "Dealer updated");
}

export async function deleteDealer(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  await dealerService.deleteDealer(actor, req.params.id);
  sendSuccess(res, null, "Dealer deleted");
}
