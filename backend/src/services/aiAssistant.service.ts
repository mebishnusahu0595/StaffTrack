import { prisma } from "../lib/prisma";
import { sendBroadcastNotification } from "./notification.service";
import { streamGeminiWithFallback, callGeminiWithFallback, getGeminiApiKey } from "../lib/gemini";
import { startOfDay } from "../lib/date";

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

  // Fetch all staff members (Employees, Managers, and Admins)
  const users = await prisma.user.findMany({
    where: { companyId, role: { in: ["EMPLOYEE", "MANAGER", "ADMIN"] } },
    select: {
      id: true, name: true, email: true, phone: true, role: true, designation: true,
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
    },
    orderBy: { date: "desc" }
  });

  // Fetch recent tasks with titles and due dates
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
    const overdueTasks = userTasks.filter(t => t.dueDate && new Date(t.dueDate) < today);
    const pendingTasks = userTasks.filter(t => t.status === "PENDING");

    const overdueTitles = overdueTasks.slice(0, 3).map(t => `"${t.title}" (Due: ${t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "N/A"})`).join(", ");
    const pendingTitles = pendingTasks.slice(0, 3).map(t => `"${t.title}"`).join(", ");

    const userLeaves = leaves.filter((l: { userId: string }) => l.userId === u.id).length;
    const todayPunch = todayAttendance.find(a => a.userId === u.id);

    let todayStatusStr = "Not Checked In Today";
    if (todayPunch) {
      const inTime = todayPunch.checkInTime ? new Date(todayPunch.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "N/A";
      const outTime = todayPunch.checkOutTime ? new Date(todayPunch.checkOutTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Currently Working";
      todayStatusStr = `Checked In at ${inTime} (${todayPunch.punchType || "GEO"}), Check-out: ${outTime}`;
    } else {
      // Find most recent past punch
      const lastPunch = userAttendance.find(a => a.checkInTime);
      if (lastPunch) {
        todayStatusStr = `Not Checked In Today (Last Punch: ${new Date(lastPunch.date).toLocaleDateString("en-IN")})`;
      }
    }

    const latestSalary = salarySlips.find(s => s.userId === u.id);

    return {
      id: u.id,
      employeeCode: u.employeeCode || "N/A",
      name: u.name,
      role: u.role,
      phone: u.phone || "N/A",
      designation: u.designation || (u.role === "ADMIN" ? "Administrator" : "Staff"),
      workMode: u.workMode || "FIELD",
      attendance: {
        thisMonthPresents: presents,
        thisMonthAbsences: absences,
        attendancePct: `${attendancePct}%`,
        todayStatus: todayStatusStr
      },
      tasks: {
        total: userTasks.length,
        overdueCount: overdueTasks.length,
        overdueSamples: overdueTitles || "None",
        pendingCount: pendingTasks.length,
        pendingSamples: pendingTitles || "None"
      },
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
• Name: ${u.name} | Phone: ${u.phone} | Emp Code: ${u.employeeCode} | Database ID: ${u.id} (${u.designation} / ${u.role})
  Attendance: ${u.attendance.thisMonthPresents} present, ${u.attendance.thisMonthAbsences} absent (${u.attendance.attendancePct} this month)
  Today Punch: ${u.attendance.todayStatus}
  Tasks: Total: ${u.tasks.total} | Overdue: ${u.tasks.overdueCount} [Titles: ${u.tasks.overdueSamples}] | Pending: ${u.tasks.pendingCount} [Titles: ${u.tasks.pendingSamples}]
  Pending Leaves: ${u.pendingLeaves}
  Salary (latest): ${u.salary ? `Net: ₹${u.salary.netPay} | Deductions: ${JSON.stringify(u.salary.deductions || {})} | Period: ${u.salary.period} | ${u.salary.status}` : "Not set"}
`).join("")}

=== END OF CONTEXT ===`;
}

const COMMON_SYSTEM_INSTRUCTIONS = (context: string) => `Aap StaffTrack workforce management platform ke intelligent HR and Staff Voice Assistant hain.
Aapka naam StaffTrack AI hai (powered by Gemini 3.8 Live).

Aapke paas company ka real-time staff data (attendance, tasks, salary, leaves, holidays, punch timings, phone numbers) context mein diya gaya hai.

BHASHA AUR BOLNE KA TARIQA (CRITICAL):
1. Aapko hamesha natural, polite aur clear HINDI / conversational HINGLISH mein baat karni hai (jaise real voice assistant baat karta hai).
   Udaharan: "Namaste! Aaj company mein 12 log present hain aur 3 absent hain."
2. Response ko conversational, seedha aur crisp rakhein taaki voice audio mein sunne mein pleasant lage.
3. CONVERSATIONAL MEMORY: Pichli baaton aur questions ko yaad rakhein. Agar user kahe "usko reminder bhej do", toh pichle context se samjhein ki kis staff ki baat ho rahi hai.

KISI BHI SPECIFIC PERSON YA EMPLOYEE KE BAARE MEIN POOCHNE PAR (HIGH PRIORITY):
Jab user kisi specific person ka naam (ya partial naam jaise 'Nandkishor', 'Ashish', 'Mohanish', 'Damini', 'Sitesh', etc.) poochta hai:
1. Unka poora naam, role/designation aur phone number batayein.
2. Aaj ka live attendance status: Aaj kitne baje check-in kiya, check-out hua ya nahi. Agar aaj check-in nahi kiya, toh unki aakhiri attendance date batayein.
3. Is mahine ki attendance summary: Kitne din present rahe, kitne absent, aur attendance percentage.
4. Tasks ka exact status: Unke overdue tasks ke exact titles aur pending tasks batayein. Agar overdue tasks hain toh batayein kitne overdue hain.
5. Proactive Help: Poochhein ki kya unhe push reminder ya notification bhejna hai? Agar user kahe 'bhej do', toh Turant unhe notification bhej dein!

NOTIFICATIONS & HOLIDAYS ACTION RULES:
- Jab bhi user kisi staff ko notification bhejne ya holiday lagane ko kahe, normal baat-cheet mein confirm karein (jaise: "Ji, maine Nandkishor ko task complete karne ka reminder bhej diya hai.").
- KABHI BHI visible sentences mein [SEND_NOTIFICATION] ya database ID mat boliye ya likhiye!
- Action tags ko response ke bilkul aakhiri line mein alag se hidden metadata ki tarah add karein:
  [SEND_NOTIFICATION userId="{database_id}" title="{title}" message="{message}"]
  [MARK_HOLIDAY date="{YYYY-MM-DD}" name="{holiday name}" scope="ALL"]
  [BULK_NOTIFY title="{title}" message="{message}" scope="ALL"]

${context}`;

/** AI Chat — sends message with full staff context, returns response text */
export async function chatWithAssistant(adminId: string, companyId: string, userMessage: string): Promise<string> {
  const fallback = "Sorry, AI assistant is currently unavailable. Please check your internet connection and try again.";

  try {
    const context = await buildStaffContext(companyId);

    if (!chatSessions.has(adminId)) {
      chatSessions.set(adminId, []);
    }
    const history = chatSessions.get(adminId)!;

    const systemPrompt = COMMON_SYSTEM_INSTRUCTIONS(context);

    const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
    const recentHistory = history.slice(-10);
    if (recentHistory.length > 0) {
      contents.push(...recentHistory);
    }
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    const data = await callGeminiWithFallback({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
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

    const systemPrompt = COMMON_SYSTEM_INSTRUCTIONS(context);

    const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
    const recentHistory = history.slice(-10);
    if (recentHistory.length > 0) {
      contents.push(...recentHistory);
    }
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    const streamResult = await streamGeminiWithFallback({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
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

    // Parse [MARK_HOLIDAY ...] actions
    const holidayRegex = /\[MARK_HOLIDAY date="([^"]+)" name="([^"]+)" scope="([^"]+)"\]/g;
    const holidayActions: Array<{ date: string; name: string; scope: string }> = [];
    let hMatch;
    while ((hMatch = holidayRegex.exec(fullText)) !== null) {
      holidayActions.push({ date: hMatch[1], name: hMatch[2], scope: hMatch[3] });
    }

    // Parse [BULK_NOTIFY ...] actions
    const bulkNotifyRegex = /\[BULK_NOTIFY title="([^"]+)" message="([^"]+)" scope="([^"]+)"\]/g;
    const bulkNotifyActions: Array<{ title: string; message: string; scope: string }> = [];
    let bMatch;
    while ((bMatch = bulkNotifyRegex.exec(fullText)) !== null) {
      bulkNotifyActions.push({ title: bMatch[1], message: bMatch[2], scope: bMatch[3] });
    }

    // Execute notification actions
    let actionResultPayload: any = null;

    if (actions.length > 0) {
      const results = await Promise.allSettled(
        actions.map(a => sendBroadcastNotification(adminId, { userIds: [a.userId], title: a.title, message: a.message }))
      );
      const sent = results.filter(r => r.status === "fulfilled").length;
      actionResultPayload = { type: "notification", sent, actions };
    }

    // Execute holiday actions (only create DB records — notifications sent on the day by scheduler)
    if (holidayActions.length > 0) {
      let totalHolidaysCreated = 0;
      for (const ha of holidayActions) {
        const holidayDate = startOfDay(new Date(ha.date));
        if (ha.scope === "ALL") {
          const allStaff = await prisma.user.findMany({
            where: { companyId, role: { in: ["EMPLOYEE", "MANAGER"] } },
            select: { id: true }
          });
          const userIds = allStaff.map(u => u.id);
          for (const uid of userIds) {
            const existing = await prisma.holiday.findFirst({
              where: { date: holidayDate, name: ha.name, companyId, userId: uid }
            });
            if (!existing) {
              await prisma.holiday.create({
                data: { date: holidayDate, name: ha.name, type: "HOLIDAY", companyId, userId: uid }
              });
              totalHolidaysCreated++;
            }
          }
        } else {
          const existing = await prisma.holiday.findFirst({
            where: { date: holidayDate, name: ha.name, companyId, userId: ha.scope }
          });
          if (!existing) {
            await prisma.holiday.create({
              data: { date: holidayDate, name: ha.name, type: "HOLIDAY", companyId, userId: ha.scope }
            });
            totalHolidaysCreated++;
          }
        }
      }
      actionResultPayload = { type: "holiday", holidaysCreated: totalHolidaysCreated, holidays: holidayActions };
    }

    // Execute bulk notify actions
    if (bulkNotifyActions.length > 0) {
      let totalNotified = 0;
      for (const bn of bulkNotifyActions) {
        if (bn.scope === "ALL") {
          const result = await sendBroadcastNotification(adminId, {
            allSelected: true,
            title: bn.title,
            message: bn.message
          });
          totalNotified += result.count || 0;
        }
      }
      actionResultPayload = { type: "bulk_notify", notified: totalNotified, actions: bulkNotifyActions };
    }

    // Yield special action-result event if any action was executed
    if (actionResultPayload) {
      yield `__ACTION_RESULT__${JSON.stringify(actionResultPayload)}`;
    }

    // Save cleaned response (strip all action markers) to session history
    const cleanedText = fullText
      .replace(actionRegex, "")
      .replace(holidayRegex, "")
      .replace(bulkNotifyRegex, "")
      .trim();
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
