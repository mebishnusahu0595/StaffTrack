import { Router } from "express";
import * as dealerController from "../controllers/dealer.controller";

const router = Router();

router.get("/", dealerController.listDealers);
router.get("/:id", dealerController.getDealer);
router.post("/", dealerController.createDealer);
router.put("/:id", dealerController.updateDealer);
router.delete("/:id", dealerController.deleteDealer);

export default router;
