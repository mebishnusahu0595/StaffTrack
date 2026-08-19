import { prisma } from "../lib/prisma";
import { sendBroadcastNotification } from "./notification.service";
import { streamGeminiWithFallback, callGeminiWithFallback, getGeminiApiKey } from "../lib/gemini";

/** In-memory session history per admin (keyed by userId) */
const chatSessions = new Map<string, Array<{ role: "user" | "model"; parts: { text: string }[] }>>();

export interface SmartNotification {
  id: string;
  userId: string;
  userName: string;
  type: "ABSENCE_WARNING" | "TASK_REMINDER" | "CHECKIN_REMINDER" | "SALARY_WARNING" | "DER_REMINDER" | "LATE_WARNING";
  title: string;
  message: string;
  severity: "high" | "medium" | "low";
  data: Record<string, any>;
}

/** Build comprehensive company staff context for Gemini prompt */
async function buildStaffContext(companyId: string): Promise<string> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Fetch all staff
  const users = await prisma.user.findMany({
    where: { companyId, role: { in: ["EMPLOYEE", "MANAGER"] } },
    select: {
      id: true, name: true, email: true, role: true, designation: true,
      workMode: true, shiftStart: true, shiftEnd: true, employeeCode: true
    }
  });

  // Fetch this month's attendance
  const attendance = await prisma.attendance.findMany({
    where: {
      date: { gte: monthStart, lte: today },
      user: { companyId }
    },
    select: {
      userId: true, date: true, status: true, checkInTime: true,
      checkOutTime: true, punchType: true, startOdometer: true, endOdometer: true
    }
  });

  // Fetch overdue/pending tasks
  const tasks = await prisma.task.findMany({
    where: {
      assignedToId: { in: users.map(u => u.id) },
      status: { in: ["PENDING", "IN_PROGRESS"] }
    },
    select: {
      id: true, title: true, status: true, dueDate: true,
      assignedToId: true, priority: true
    },
    orderBy: { dueDate: "asc" }
  });

  // Fetch pending leaves
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: users.map(u => u.id) },
      status: "PENDING"
    },
    select: { userId: true, startDate: true, endDate: true, reason: true }
  });

  // Fetch salary slips (latest per user)
  const salarySlips = await prisma.salarySlip.findMany({
    where: { userId: { in: users.map(u => u.id) } },
    orderBy: { createdAt: "desc" },
    take: users.length * 2,
    select: {
      userId: true, month: true, year: true, netPay: true, deductions: true, status: true
    }
  });

  // Fetch today's attendance
  const todayStr = today.toISOString().slice(0, 10);
  const todayAttendance = attendance.filter(a => a.date.toISOString().slice(0, 10) === todayStr);

  // Build per-user summary
  const userSummaries = users.map(u => {
    const userAttendance = attendance.filter(a => a.userId === u.id);
    const absences = userAttendance.filter(a => a.status === "ABSENT").length;
    const presents = userAttendance.filter(a => a.status === "PRESENT").length;
    const workingDays = userAttendance.length;
    const attendancePct = workingDays > 0 ? Math.round((presents / workingDays) * 100) : 100;

    const userTasks = tasks.filter(t => t.assignedToId === u.id);
    const overdueTasks = userTasks.filter(t => t.dueDate && new Date(t.dueDate) < today).length;
    const pendingTasks = userTasks.filter(t => t.status === "PENDING").length;

    const userLeaves = leaves.filter((l: { userId: string }) => l.userId === u.id).length;
    const todayPunch = todayAttendance.find(a => a.userId === u.id);

    const latestSalary = salarySlips.find(s => s.userId === u.id);

    return {
      id: u.id,
      employeeCode: u.employeeCode || "N/A",
      name: u.name,
      role: u.role,
      designation: u.designation || "Staff",
      workMode: u.workMode,
      attendance: {
        thisMonthPresents: presents,
        thisMonthAbsences: absences,
        attendancePct: `${attendancePct}%`,
        todayStatus: todayPunch ? (todayPunch.checkOutTime ? "Checked Out" : "Currently Checked In") : "Not Checked In"
      },
      tasks: { total: userTasks.length, overdue: overdueTasks, pending: pendingTasks },
      pendingLeaves: userLeaves,
      salary: latestSalary ? {
        period: `${latestSalary.month}/${latestSalary.year}`,
        netPay: latestSalary.netPay,
        deductions: latestSalary.deductions,
        status: latestSalary.status
      } : null
    };
  });

  const presentToday = todayAttendance.filter(a => a.checkInTime).length;
  const absentToday = users.length - presentToday;

  return `
=== STAFFTRACK COMPANY DATA CONTEXT (as of ${today.toDateString()}) ===

OVERVIEW:
- Total Staff: ${users.length}
- Today: ${presentToday} checked in, ${absentToday} not checked in
- Month: ${new Date().toLocaleString("default", { month: "long", year: "numeric" })}

STAFF DETAILS:
${userSummaries.map(u => `
• Name: ${u.name} | ID (Employee Code): ${u.employeeCode} | Database ID: ${u.id} (${u.designation} / ${u.role})
  Attendance: ${u.attendance.thisMonthPresents} present, ${u.attendance.thisMonthAbsences} absent (${u.attendance.attendancePct} this month)
  Today: ${u.attendance.todayStatus}
  Tasks: ${u.tasks.total} total | ${u.tasks.overdue} OVERDUE | ${u.tasks.pending} pending
  Pending Leave Requests: ${u.pendingLeaves}
  Salary (latest): ${u.salary ? `Net: ₹${u.salary.netPay} | Deductions: ${JSON.stringify(u.salary.deductions || {})} | Period: ${u.salary.period} | ${u.salary.status}` : "Not set"}
`).join("")}

=== END OF CONTEXT ===`;
}

/** AI Chat — sends message with full staff context, returns response text */
export async function chatWithAssistant(adminId: string, companyId: string, userMessage: string): Promise<string> {
  const fallback = "Sorry, AI assistant is currently unavailable. Please check your internet connection and try again.";

  try {
    const context = await buildStaffContext(companyId);

    if (!chatSessions.has(adminId)) {
      chatSessions.set(adminId, []);
    }
    const history = chatSessions.get(adminId)!;

    const systemPrompt = `You are an intelligent HR and Staff Management AI Assistant for StaffTrack — a workforce management platform.

You have access to real-time company data provided below. Your role is to:
1. Answer questions about staff attendance, tasks, salary, deductions, leaves accurately using the data
2. Suggest specific, actionable HR decisions (who to warn, who to reward, what deductions to apply)
3. Generate professional notification messages in English or Hindi when asked
4. Identify patterns and flag concerns proactively
5. NEVER make up data — only use what is provided in the context

FORMATTING RULES (strictly follow):
- Do NOT use markdown symbols like ** for bold or # for headings
- Use plain text only
- Use bullet points with the • character for lists
- Use emoji sparingly (max 1-2 per response) for key points only
- Be concise and direct — no filler phrases
- When listing staff, show: Name — reason (e.g. 5 absences this month)

NOTIFICATION ACTIONS:
If the user asks you to send a notification, message, or reminder to a specific staff member:
1. Match the staff member by Name (partial match is allowed), ID (Employee Code e.g. 103), or email.
2. If multiple staff match the search name (e.g., duplicate names like two Vikram's or similar last names), you MUST NOT trigger a notification. Instead, list the matches with their Name and ID (Employee Code) and ask the user to clarify who they want to notify.
3. If no staff matches the search name (spelling mistake or user doesn't exist), check the staff list and suggest the closest sounding name(s) (e.g., "I couldn't find anyone named Dikshant. Did you mean Deepika?"). Do not trigger any notifications.
4. If a single unique staff matches:
   At the VERY END of your response, on a new line, add:
   [SEND_NOTIFICATION userId="{database_id}" title="{notification title}" message="{the message}"]
   NOTE: You MUST use the Database ID (UUID/CUID e.g. cl...) for the userId parameter, NOT the name, and NOT the 3-digit Employee Code!
5. Confirm in your response text that you have sent the notification to the unique match.

${context}`;

    const buildContents = (msg: string) => {
      const baseContents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [
        { role: "user", parts: [{ text: systemPrompt + "\n\nQuestion: " + msg }] }
      ];
      const recentHistory = history.slice(-8);
      if (recentHistory.length > 0) {
        baseContents.push(...recentHistory);
        baseContents.push({ role: "user", parts: [{ text: msg }] });
      }
      return baseContents;
    };

    const data = await callGeminiWithFallback({
      contents: buildContents(userMessage),
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
    });

    if (!data) return fallback;

    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) return fallback;

    // Save to session history
    history.push({ role: "user", parts: [{ text: userMessage }] });
    history.push({ role: "model", parts: [{ text: aiText }] });
    if (history.length > 20) history.splice(0, history.length - 20);

    return aiText;
  } catch (err: any) {
    console.warn("[AI Assistant] Error:", err?.message);
    return fallback;
  }
}

/** Streaming chat — yields text chunks as they arrive from Gemini */
export async function* chatWithAssistantStream(
  adminId: string,
  companyId: string,
  userMessage: string
): AsyncGenerator<string> {
  try {
    const context = await buildStaffContext(companyId);

    if (!chatSessions.has(adminId)) chatSessions.set(adminId, []);
    const history = chatSessions.get(adminId)!;

    const systemPrompt = `You are an intelligent HR and Staff Management AI Assistant for StaffTrack — a workforce management platform.

You have access to real-time company data below. Answer accurately using only provided data.

FORMATTING RULES (strictly follow):
- Do NOT use markdown symbols like ** or # 
- Plain text only
- Use • for bullet lists
- Use emoji sparingly (max 2 per response)
- Be concise and direct
- When listing staff: Name — reason (e.g. 5 absences this month)

NOTIFICATION ACTIONS:
If the user asks you to send a notification, message, or reminder to a specific staff member:
1. Match the staff member by Name (partial match is allowed), ID (Employee Code e.g. 103), or email.
2. If multiple staff match the search name (e.g., duplicate names like two Vikram's or similar last names), you MUST NOT trigger a notification. Instead, list the matches with their Name and ID (Employee Code) and ask the user to clarify who they want to notify.
3. If no staff matches the search name (spelling mistake or user doesn't exist), check the staff list and suggest the closest sounding name(s) (e.g., "I couldn't find anyone named Dikshant. Did you mean Deepika?"). Do not trigger any notifications.
4. If a single unique staff matches:
   At the VERY END of your response, on a new line, add:
   [SEND_NOTIFICATION userId="{database_id}" title="{notification title}" message="{the message}"]
   NOTE: You MUST use the Database ID (UUID/CUID e.g. cl...) for the userId parameter, NOT the name, and NOT the 3-digit Employee Code!
5. Confirm in your response text that you have sent the notification to the unique match.

${context}`;

    const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [
      { role: "user", parts: [{ text: systemPrompt + "\n\nQuestion: " + userMessage }] }
    ];
    const recentHistory = history.slice(-8);
    if (recentHistory.length > 0) {
      contents.push(...recentHistory);
      contents.push({ role: "user", parts: [{ text: userMessage }] });
    }

    const streamResult = await streamGeminiWithFallback({
      contents,
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
    });

    if (!streamResult || !streamResult.response || !streamResult.response.body) {
      console.warn("[AI Stream] Gemini models exhausted or stream unavailable");
      yield "Sorry, AI assistant is currently unavailable. Please try again.";
      return;
    }

    const response = streamResult.response;
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json);
          const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunk) {
            fullText += chunk;
            yield chunk;
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // Parse [SEND_NOTIFICATION ...] actions from full text
    const actionRegex = /\[SEND_NOTIFICATION userId="([^"]+)" title="([^"]+)" message="([^"]+)"\]/g;
    const actions: Array<{ userId: string; title: string; message: string }> = [];
    let match;
    while ((match = actionRegex.exec(fullText)) !== null) {
      actions.push({ userId: match[1], title: match[2], message: match[3] });
    }

    // Execute notification actions
    if (actions.length > 0) {
      const results = await Promise.allSettled(
        actions.map(a => sendBroadcastNotification(adminId, { userIds: [a.userId], title: a.title, message: a.message }))
      );
      const sent = results.filter(r => r.status === "fulfilled").length;
      // Yield special action-result event (JSON prefixed so frontend can detect it)
      yield `__ACTION_RESULT__${JSON.stringify({ sent, actions })}`;
    }

    // Save cleaned response (strip action markers) to session history
    const cleanedText = fullText.replace(actionRegex, "").trim();
    if (cleanedText) {
      history.push({ role: "user", parts: [{ text: userMessage }] });
      history.push({ role: "model", parts: [{ text: cleanedText }] });
      if (history.length > 20) history.splice(0, history.length - 20);
    }
  } catch (err: any) {
    console.warn("[AI Stream] Error:", err?.message);
    yield "Sorry, AI assistant is currently unavailable. Please check your connection.";
  }
}

/** Clear chat session for an admin */
export function clearChatSession(adminId: string) {
  chatSessions.delete(adminId);
}


/** Smart Notification Algorithm — analyzes staff data and generates suggested notifications */
export async function generateSmartNotifications(companyId: string): Promise<SmartNotification[]> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const todayStr = today.toISOString().slice(0, 10);
  const currentHour = today.getHours();

  const users = await prisma.user.findMany({
    where: { companyId, role: { in: ["EMPLOYEE", "MANAGER"] } },
    select: { id: true, name: true }
  });

  const attendance = await prisma.attendance.findMany({
    where: { date: { gte: monthStart }, user: { companyId } },
    select: { userId: true, date: true, status: true, checkInTime: true, checkOutTime: true }
  });

  const tasks = await prisma.task.findMany({
    where: {
      assignedToId: { in: users.map(u => u.id) },
      status: { in: ["PENDING", "IN_PROGRESS"] },
      dueDate: { lt: today }
    },
    select: { assignedToId: true, title: true, dueDate: true }
  });

  // DER check
  const dayEndReports = await prisma.dayEndReport.findMany({
    where: {
      userId: { in: users.map(u => u.id) },
      date: { gte: new Date(todayStr) }
    },
    select: { userId: true }
  });
  const derUserIds = new Set(dayEndReports.map(d => d.userId));

  const notifications: SmartNotification[] = [];

  for (const user of users) {
    const userAttendance = attendance.filter(a => a.userId === user.id);
    const absences = userAttendance.filter(a => a.status === "ABSENT").length;
    const presents = userAttendance.filter(a => a.status === "PRESENT").length;
    const workingDays = userAttendance.length;
    const attendancePct = workingDays > 0 ? (presents / workingDays) * 100 : 100;

    const todayPunch = userAttendance.find(a => a.date.toISOString().slice(0, 10) === todayStr);
    const isCheckedIn = Boolean(todayPunch?.checkInTime);
    const isCheckedOut = Boolean(todayPunch?.checkOutTime);

    const userOverdueTasks = tasks.filter(t => t.assignedToId === user.id);

    // Rule 1: 3+ absences this month
    if (absences >= 3) {
      notifications.push({
        id: `absence-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "ABSENCE_WARNING",
        title: "Attendance Warning",
        message: `${user.name}, you have been absent ${absences} times this month. Please ensure regular attendance to avoid salary deduction.`,
        severity: absences >= 5 ? "high" : "medium",
        data: { absences, attendancePct: Math.round(attendancePct) }
      });
    }

    // Rule 2: 2+ overdue tasks
    if (userOverdueTasks.length >= 2) {
      notifications.push({
        id: `tasks-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "TASK_REMINDER",
        title: "Overdue Tasks Reminder",
        message: `${user.name}, you have ${userOverdueTasks.length} overdue tasks. Please complete them as soon as possible.`,
        severity: userOverdueTasks.length >= 4 ? "high" : "medium",
        data: { overdueTasks: userOverdueTasks.length }
      });
    }

    // Rule 3: Not checked in after 10:30 AM on a workday
    if (!isCheckedIn && currentHour >= 10 && currentHour < 14) {
      notifications.push({
        id: `checkin-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "CHECKIN_REMINDER",
        title: "Check-in Reminder",
        message: `${user.name}, you haven't checked in yet today. Please mark your attendance.`,
        severity: "low",
        data: { currentTime: today.toLocaleTimeString() }
      });
    }

    // Rule 4: Low attendance % (< 75%)
    if (attendancePct < 75 && workingDays >= 10) {
      notifications.push({
        id: `salary-warn-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "SALARY_WARNING",
        title: "Salary Deduction Warning",
        message: `${user.name}, your attendance this month is ${Math.round(attendancePct)}%, which is below 75%. This may affect your salary.`,
        severity: "high",
        data: { attendancePct: Math.round(attendancePct) }
      });
    }

    // Rule 5: No DER submitted after 6 PM for checked-in staff
    if (isCheckedIn && !isCheckedOut && currentHour >= 18 && !derUserIds.has(user.id)) {
      notifications.push({
        id: `der-${user.id}`,
        userId: user.id,
        userName: user.name,
        type: "DER_REMINDER",
        title: "Day End Report Reminder",
        message: `${user.name}, please submit your Day End Report before checking out.`,
        severity: "low",
        data: {}
      });
    }
  }

  // Sort: high severity first
  return notifications.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

/** Send selected notifications to staff via push + DB */
export async function sendSmartNotifications(
  adminId: string,
  notifications: Array<{ userId: string; title: string; message: string }>
): Promise<{ sent: number }> {
  const results = await Promise.allSettled(
    notifications.map(n =>
      sendBroadcastNotification(adminId, {
        userIds: [n.userId],
        title: n.title,
        message: n.message
      })
    )
  );
  const sent = results.filter(r => r.status === "fulfilled").length;
  return { sent };
}
