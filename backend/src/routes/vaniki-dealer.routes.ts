import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as vanikiDealerController from "../controllers/vaniki-dealer.controller";

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "vaniki-proof-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// 1. Dealer Activities & Monitoring Feed (Live Feed for Admin Dashboard)
router.get("/activities", vanikiDealerController.getVanikiActivities);

// 2. Dealer Lookup (By 4-Digit ID or Mobile)
router.get("/lookup/:code", vanikiDealerController.lookupDealer);

// 3. Fetch Wholesale Products Catalog
router.get("/products", vanikiDealerController.getWholesaleProducts);

// 4. Fetch Dynamic Bank Details & QR Code
router.get("/bank-details", vanikiDealerController.getBankDetails);

// 4b. Fetch SuperAdmin Garages / Warehouses List
router.get("/garages", vanikiDealerController.getGarages);

// 5. Place Order for Dealer

router.post("/orders/:dealerCode", vanikiDealerController.placeDealerOrder);

// 5. Record Credit Due Payment or Limit Adjustment
router.post("/credit-adjustment", vanikiDealerController.recordCreditAdjustment);

// 6. Upload Payment Proof / Slip
router.post("/upload", upload.single("file"), (req, res) => {

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    fileUrl,
    url: fileUrl,
    filename: req.file.filename,
  });
});

export default router;
