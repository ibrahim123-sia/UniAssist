import Issue from "../models/Issue.js";
import Department, { SLA_HOURS_MIN, SLA_HOURS_MAX } from "../models/Department.js";
import User from "../models/User.js";
import { notify } from "./notify.js";

// Background jobs. Today just one: SLA escalation for complaints nobody has
// responded to. Plain timers (no cron dependency) — the server is a single
// process, and every job here is idempotent, so a missed or doubled tick is
// harmless.

const SLA_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;
const DEFAULT_SLA_HOURS = 48;
// First run on an old database could find hundreds of overdue complaints at
// once: escalate at most this many per run (the rest follow on later runs),
// and leave complaints older than STALE_DAYS alone — escalating a months-old
// backlog would only flood inboxes.
export const MAX_ESCALATIONS_PER_RUN = 50;
export const STALE_DAYS = 30;

// ISSUE_SLA_HOURS from the environment, else 48.
export const defaultSlaHours = () => {
  const n = Number(process.env.ISSUE_SLA_HOURS);
  return Number.isFinite(n) && n >= SLA_HOURS_MIN && n <= SLA_HOURS_MAX ? n : DEFAULT_SLA_HOURS;
};

// Who hears about an overdue issue in `dept`: its head when one is set (and
// still an active staff member there), otherwise all of its active staff.
async function escalationRecipients(dept) {
  if (dept.head) {
    const head = await User.findOne({
      _id: dept.head,
      role: "staff",
      department: dept._id,
      isBlocked: false,
    });
    if (head) return [head];
  }
  return User.find({ role: "staff", department: dept._id, isBlocked: false });
}

// Escalate every Pending issue that has waited longer than its department's
// SLA without any staff response. The flip to escalated is atomic
// (escalated:false in the filter), so two overlapping runs — or two server
// processes — can never notify twice. Returns the number escalated.
export async function runSlaCheck(now = new Date(), { limit = MAX_ESCALATIONS_PER_RUN } = {}) {
  const fallbackHours = defaultSlaHours();
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const departments = await Department.find({}).select("code name slaHours head");
  let admins = null;
  let count = 0;

  for (const dept of departments) {
    if (count >= limit) break;
    const hours = dept.slaHours ?? fallbackHours;
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const overdueFilter = {
      department: dept._id,
      status: "Pending",
      firstStaffResponseAt: null,
      escalated: { $ne: true },
      createdAt: { $lt: cutoff, $gte: staleBefore },
      // Issues from before firstStaffResponseAt existed: a staff reply counts.
      "replies.authorRole": { $ne: "staff" },
    };
    const candidates = await Issue.find(overdueFilter)
      .sort({ createdAt: 1 })
      .limit(limit - count)
      .select("_id");
    if (candidates.length === 0) continue;

    let recipients = null;
    for (const { _id } of candidates) {
      // timestamps:false — escalation must not bump updatedAt, or the staff
      // UI's expectedUpdatedAt check would report a phantom conflict.
      const issue = await Issue.findOneAndUpdate(
        { ...overdueFilter, _id },
        { $set: { escalated: true, escalatedAt: now } },
        { returnDocument: "after", timestamps: false }
      );
      if (!issue) continue;
      count++;

      recipients ??= await escalationRecipients(dept);
      admins ??= await User.find({ role: "admin", isBlocked: { $ne: true } });

      const waited = `${hours} hour${hours === 1 ? "" : "s"}`;
      const base = {
        type: "issue_escalated",
        issueId: issue._id,
        message: `Overdue: "${issue.title}" (${dept.code}) has had no staff response for over ${waited}`,
        emailSubject: `[${dept.code}] Complaint overdue — no response in ${waited}`,
        emailHeading: "A complaint has passed its response deadline",
        emailBody: `${issue.title}\n\nFrom: ${issue.studentName} (${issue.studentEmail})\nDepartment: ${dept.code} — ${dept.name}\nSubmitted: ${issue.createdAt.toUTCString()}\n\nNo staff member has responded within the ${waited} limit.`,
      };
      await Promise.all([
        ...recipients.map((u) => notify(u, { ...base, link: `/staff/issues/${issue._id}` })),
        ...admins.map((u) => notify(u, { ...base, link: `/admin/query?issue=${issue._id}` })),
      ]);
    }
  }

  if (count > 0) {
    console.log(
      `SLA check: escalated ${count} overdue issue(s)${count >= limit ? " (per-run cap reached; the rest follow on the next run)" : ""}`
    );
  }
  return count;
}

let started = false;
let slaRunning = false;

const safeSlaCheck = async () => {
  if (slaRunning) return;
  slaRunning = true;
  try {
    await runSlaCheck();
  } catch (error) {
    console.error("SLA check failed:", error.message);
  } finally {
    slaRunning = false;
  }
};

// Called from server.js once the database is connected. Off under tests
// (NODE_ENV=test) or with DISABLE_SCHEDULERS=true.
export function startSchedulers() {
  if (started) return;
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_SCHEDULERS === "true") return;
  started = true;
  setTimeout(safeSlaCheck, FIRST_RUN_DELAY_MS).unref();
  setInterval(safeSlaCheck, SLA_CHECK_INTERVAL_MS).unref();
}
