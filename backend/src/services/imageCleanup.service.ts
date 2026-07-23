import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".bmp"];

export async function cleanupOldImages(): Promise<{ deletedFilesCount: number; freedBytes: number }> {
  try {
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) {
      return { deletedFilesCount: 0, freedBytes: 0 };
    }

    const now = new Date();
    // Start of previous month: (Current month - 1), 1st day at 00:00:00
    // E.g. If current month is July 2026, cutoff is June 1 2026 00:00:00.
    // Images uploaded in July 2026 & June 2026 are kept; images before June 1 2026 are deleted.
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const cutoffMs = cutoffDate.getTime();

    console.log(`[ImageCleanup] Running cleanup for images created before ${cutoffDate.toISOString().split("T")[0]}`);

    const files = await fs.promises.readdir(uploadsDir);
    let deletedFilesCount = 0;
    let freedBytes = 0;

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(ext)) {
        continue; // Skip non-images (PDFs, DOCs, etc.)
      }

      const filePath = path.join(uploadsDir, file);
      try {
        const stats = await fs.promises.stat(filePath);
        // Use mtime or birthtime
        const fileTime = Math.min(stats.mtimeMs, stats.birthtimeMs);

        if (fileTime < cutoffMs) {
          freedBytes += stats.size;
          await fs.promises.unlink(filePath);
          deletedFilesCount++;
        }
      } catch (err) {
        console.error(`[ImageCleanup] Failed to stat/unlink file ${file}:`, err);
      }
    }

    // Clear photo references in attendance & day-end report DB records older than cutoffDate
    try {
      await prisma.attendance.updateMany({
        where: {
          date: { lt: cutoffDate },
          OR: [
            { checkInPhotoUrl: { not: null } },
            { checkOutPhotoUrl: { not: null } },
            { startOdometerPhotoUrl: { not: null } },
            { endOdometerPhotoUrl: { not: null } }
          ]
        },
        data: {
          checkInPhotoUrl: null,
          checkOutPhotoUrl: null,
          startOdometerPhotoUrl: null,
          endOdometerPhotoUrl: null
        }
      });

      await prisma.dayEndReport.updateMany({
        where: {
          date: { lt: cutoffDate },
          OR: [
            { kmPhotoUrl: { not: null } },
            { startOdometerPhotoUrl: { not: null } }
          ]
        },
        data: {
          kmPhotoUrl: null,
          startOdometerPhotoUrl: null
        }
      });
    } catch (dbErr) {
      console.error("[ImageCleanup] Error clearing old DB photo URLs:", dbErr);
    }

    const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
    console.log(`[ImageCleanup] Complete. Deleted ${deletedFilesCount} old image files (${freedMB} MB freed).`);
    return { deletedFilesCount, freedBytes };
  } catch (error) {
    console.error("[ImageCleanup] Error running image cleanup:", error);
    return { deletedFilesCount: 0, freedBytes: 0 };
  }
}
