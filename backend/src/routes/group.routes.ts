import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import * as groupController from "../controllers/group.controller";

const router = Router();

router.get("/", asyncHandler(groupController.listGroups));
router.post("/", asyncHandler(groupController.createGroup));
router.patch("/:id", asyncHandler(groupController.updateGroup));
router.delete("/:id", asyncHandler(groupController.deleteGroup));

export default router;
