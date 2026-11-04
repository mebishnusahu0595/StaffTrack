import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  try {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const mime = (req.file.mimetype || "").toLowerCase();
    const isImage = mime.startsWith("image/") || /\.(jpe?g|png|webp|heic|bmp|tiff)$/i.test(req.file.originalname);

    let outputFilename = uniqueSuffix + path.extname(req.file.originalname || ".bin");

    if (isImage && !mime.includes("gif") && !mime.includes("svg")) {
      // Compress and resize image: max 1280x1280, 75% quality JPEG, auto-rotate EXIF
      outputFilename = uniqueSuffix + ".jpg";
      const targetPath = path.join(uploadDir, outputFilename);

      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 75, progressive: true })
        .toFile(targetPath);
    } else {
      // Non-image or animated/vector: write directly
      const targetPath = path.join(uploadDir, outputFilename);
      await fs.promises.writeFile(targetPath, req.file.buffer);
    }

    const fileUrl = `/uploads/${outputFilename}`;
    res.json({ success: true, url: fileUrl });
  } catch (err: any) {
    console.error("[Upload] Error processing image with sharp, saving raw:", err);
    try {
      const fallbackFilename = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(req.file.originalname || ".bin");
      await fs.promises.writeFile(path.join(uploadDir, fallbackFilename), req.file.buffer);
      res.json({ success: true, url: `/uploads/${fallbackFilename}` });
    } catch (saveErr: any) {
      res.status(500).json({ success: false, message: "Failed to save file", error: err.message });
    }
  }
});

export default router;
