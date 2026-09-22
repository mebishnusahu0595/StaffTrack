import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import * as vanikiDealerService from "../services/vaniki-dealer.service";

export async function lookupDealer(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const actor = req.user;
  const result = await vanikiDealerService.lookupDealer(code, actor);
  sendSuccess(res, result, "Dealer details fetched successfully");
}

export async function getWholesaleProducts(_req: Request, res: Response): Promise<void> {
  const result = await vanikiDealerService.getWholesaleProducts();
  sendSuccess(res, result, "Wholesale products catalog fetched successfully");
}

export async function getBankDetails(_req: Request, res: Response): Promise<void> {
  const result = await vanikiDealerService.getBankDetails();
  sendSuccess(res, result, "Dynamic bank details & UPI QR fetched successfully");
}


export async function placeDealerOrder(req: Request, res: Response): Promise<void> {
  const { dealerCode } = req.params;
  const actor = req.user!;
  const result = await vanikiDealerService.placeDealerOrder(dealerCode, req.body, actor);
  sendSuccess(res, result, "Dealer order placed successfully", 201);
}

export async function getVanikiActivities(req: Request, res: Response): Promise<void> {
  const { action, search, staffId, limit, offset } = req.query;
  const result = await vanikiDealerService.getVanikiActivities({
    action: action as string,
    search: search as string,
    staffId: staffId as string,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });
  sendSuccess(res, result, "Vaniki dealer activities fetched successfully");
}
