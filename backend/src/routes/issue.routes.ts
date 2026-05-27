import { Router } from "express";
import * as issueController from "../controllers/issue.controller";
import { auth } from "../middleware/auth";

const router = Router();

router.use(auth);

router.get("/", issueController.listIssues);
router.post("/", issueController.createIssue);
router.get("/:id", issueController.getIssue);
router.patch("/:id", issueController.updateIssue);
router.post("/:id/updates", issueController.addIssueUpdate);

export default router;
