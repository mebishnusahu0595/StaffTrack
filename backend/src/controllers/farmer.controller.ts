import type { Request, Response } from "express";
import { sendSuccess } from "../lib/response";
import {
  listFarmers,
  getFarmer,
  getFarmerVisits,
  createFarmer,
  updateFarmer,
  deleteFarmer,
} from "../services/farmer.service";


export async function listFarmersHandler(req: Request, res: Response) {
  const farmers = await listFarmers(req.user!.companyId);
  sendSuccess(res, farmers, "Farmers fetched");
}

export async function getFarmerHandler(req: Request, res: Response) {
  try {
    const farmer = await getFarmer(req.user!.companyId, req.params.id);
    sendSuccess(res, farmer, "Farmer fetched");
  } catch {
    res.status(404).json({ success: false, message: "Farmer not found" });
  }
}

export async function getFarmerVisitsHandler(req: Request, res: Response) {
  try {
    const data = await getFarmerVisits(req.user!.companyId, req.params.id);
    sendSuccess(res, data, "Farmer visits fetched");
  } catch (err: any) {
    res.status(404).json({ success: false, message: err?.message || "Farmer not found" });
  }
}




export async function createFarmerHandler(req: Request, res: Response) {
  const { name, phone, village, address, city, district, state, crop, landSize, notes } = req.body;
  if (!name) {
    res.status(400).json({ success: false, message: "Farmer name is required" });
    return;
  }
  const farmer = await createFarmer(req.user!.companyId, {
    name, phone, village, address, city, district, state, crop, landSize, notes,
  });
  sendSuccess(res, farmer, "Farmer created", 201);
}

export async function updateFarmerHandler(req: Request, res: Response) {
  try {
    const farmer = await updateFarmer(req.user!.companyId, req.params.id, req.body);
    sendSuccess(res, farmer, "Farmer updated");
  } catch {
    res.status(404).json({ success: false, message: "Farmer not found" });
  }
}

export async function deleteFarmerHandler(req: Request, res: Response) {
  await deleteFarmer(req.user!.companyId, req.params.id);
  sendSuccess(res, null, "Farmer deleted");
}
