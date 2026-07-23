import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import zlib from "zlib";
import { errorHandler } from "./lib/errors";
import { auth } from "./middleware/auth";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import taskRoutes from "./routes/task.routes";
import locationRoutes from "./routes/location.routes";
import attendanceRoutes from "./routes/attendance.routes";
import reportRoutes from "./routes/report.routes";
import expenseRoutes from "./routes/expense.routes";
import uploadRoutes from "./routes/upload.routes";
import superadminRoutes from "./routes/superadmin.routes";
import projectRoutes from "./routes/project.routes";
import issueRoutes from "./routes/issue.routes";
import formRoutes from "./routes/form.routes";
import templateRoutes from "./routes/template.routes";
import groupRoutes from "./routes/group.routes";
import holidayRoutes from "./routes/holiday.routes";
import payrollRoutes from "./routes/payroll.routes";
import notificationRoutes from "./routes/notification.routes";
import leaveRoutes from "./routes/leave.routes";
import teamRoutes from "./routes/team.routes";
import salaryRoutes from "./routes/salary.routes";
import documentRoutes from "./routes/document.routes";
import path from "path";
import { initSocket } from "./lib/socket";
import { corsOrigin } from "./lib/cors";
import { startScheduler } from "./lib/scheduler";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 4000);

// Initialize Socket.io
initSocket(httpServer);

// Start daily/startup auto-checkout scheduler
startScheduler();

// Native Gzip Compression Middleware
app.use((req, res, next) => {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  if (!acceptEncoding.includes("gzip")) {
    return next();
  }

  const oldWrite = res.write;
  const oldEnd = res.end;
  const chunks: Buffer[] = [];

  res.write = ((chunk: any) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return true;
  }) as any;

  res.end = ((chunk: any) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    const contentType = String(res.getHeader("Content-Type") || "");

    if (
      buffer.length > 1024 &&
      (contentType.includes("json") || contentType.includes("text") || contentType.includes("javascript"))
    ) {
      zlib.gzip(buffer, (err, result) => {
        if (err) {
          res.write = oldWrite;
          res.end = oldEnd;
          return res.end(buffer);
        }
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Content-Length", result.length);
        (oldWrite as any).call(res, result);
        (oldEnd as any).call(res);
      });
    } else {
      res.write = oldWrite;
      res.end = oldEnd;
      return res.end(buffer);
    }
  }) as any;

  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

// DEBUG LOGGER: See if the phone is reaching the server
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads"), {
  maxAge: "30d",
  immutable: true
}));

app.use("/api/auth", authRoutes);

// Protect all other /api routes
app.use("/api", auth);

app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/salary-slips", salaryRoutes);
app.use("/api/documents", documentRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: "Not Found"
  });
});

app.use(errorHandler);

httpServer.listen(port, () => {
  console.log(`StaffTrack API listening on port ${port} (with WebSockets)`);
});

export default app;
