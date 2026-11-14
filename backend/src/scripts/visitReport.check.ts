// Run: ./node_modules/.bin/tsx -r dotenv/config src/scripts/visitReport.check.ts
import assert from "node:assert";
import { prisma } from "../lib/prisma";
import { buildVisitReport, getMyContacts, taskQA } from "../services/visitReport.service";

// admin's questions are kept, answers matched by id, unanswered shown as null, extras kept
const qa = taskQA(
  [{ id: "q1", title: "Crop Name", validations: ["TEXT"] }, { id: "q2", title: "Photo", validations: ["IMAGE"] }, { id: "q3", title: "Land" }],
  [{ id: "q1", title: "Crop Name", type: "TEXT", value: "Wheat" }, { id: "q2", type: "IMAGE", fileUrl: "u.jpg" }, { id: "old", title: "Old Q", value: "x" }]
);
assert.deepStrictEqual(qa.map((q) => [q.question, q.value ?? q.fileUrl]), [["Crop Name", "Wheat"], ["Photo", "u.jpg"], ["Land", null], ["Old Q", "x"]]);
assert.strictEqual(taskQA(null, { q1: { text: "hi" } })[0].value, "hi"); // legacy object format

(async () => {
  for (const kind of ["dealer", "farmer"] as const) {
    const e: any = await (prisma as any)[kind].findFirst({ where: { tasks: { some: {} } } });
    if (!e) { console.log(`no ${kind} with tasks in DB, skipped`); continue; }
    const t0 = Date.now();
    const r = await buildVisitReport(e.companyId, { [`${kind}s`]: { some: { id: e.id } } }, e.name);
    console.log(kind, e.name, `${Date.now() - t0}ms`, JSON.stringify(r.summary).slice(0, 300), "profile:", r.profile.length);
  }
  const u = await prisma.user.findFirst({ where: { assignedTasks: { some: { OR: [{ dealers: { some: {} } }, { farmers: { some: {} } }] } } } });
  if (u) {
    const t0 = Date.now();
    const c = await getMyContacts(u.companyId, u.id);
    console.log("contacts", u.name, `${Date.now() - t0}ms`, c.dealers.length, c.farmers.length, JSON.stringify(c.dealers[0] ?? c.farmers[0]));
  }
  console.log("ok");
  await prisma.$disconnect();
})();
