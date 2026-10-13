import Department from "../models/Department.js";
import Issue from "../models/Issue.js";

// Which department should a complaint go to? Cheap word-overlap scoring —
// no model, no LLM call — between the student's text and what each active
// department is about (code + name + description + titles of its recent
// issues), plus a small built-in hint map for the usual MAJU department codes.
// It only pre-selects the dropdown; the student always confirms.

const RECENT_TITLES_PER_DEPT = 200;
const TITLES_CACHE_MS = 5 * 60 * 1000;
const MAX_TEXT_CHARS = 2000;

// Below this the guess is too weak to pre-select anything.
const MIN_SCORE = 2;

const DESCRIPTOR_WEIGHT = 2; // word in the department's code/name/description
const TITLE_WEIGHT = 1;      // word seen in one of its recent issue titles
const HINT_WEIGHT = 3;       // word in the built-in hint map below

// English + Roman-Urdu filler words that say nothing about the department.
const STOPWORDS = new Set([
  // English
  "a", "about", "after", "again", "all", "also", "am", "an", "and", "any", "are", "as", "at", "be",
  "been", "before", "being", "but", "by", "can", "could", "did", "do", "does", "doing", "dont", "for",
  "from", "get", "got", "had", "has", "have", "having", "he", "her", "here", "him", "his", "how", "i",
  "if", "im", "in", "into", "is", "it", "its", "ive", "just", "kindly", "me", "my", "myself", "need",
  "no", "not", "now", "of", "on", "or", "our", "please", "pls", "plz", "regarding", "she", "should",
  "so", "some", "still", "sir", "maam", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "to", "too", "up", "us", "very", "want", "was", "we", "were", "what", "when",
  "where", "which", "who", "why", "will", "with", "would", "yet", "you", "your", "hello", "hi", "dear",
  "thanks", "thank", "help", "issue", "problem", "complaint", "department",
  // Roman Urdu
  "aap", "ap", "apna", "apne", "bhi", "hai", "hain", "ho", "hoga", "hogi", "hona", "hua", "hui",
  "hy", "ka", "kab", "kar", "karna", "karo", "kare", "karen", "ke", "kh", "ki", "kia", "kiya", "ko",
  "koi", "kuch", "kya", "kyun", "liye", "lye", "main", "mein", "mera", "meri", "mere", "mujhe",
  "mjhe", "na", "nahi", "nahin", "ne", "par", "pe", "se", "tha", "thi", "to", "tou", "wala", "wali",
  "woh", "ye", "yeh", "aur", "abhi", "masla", "shikayat",
]);

// Common department codes → words that point at them. Each entry lists codes
// in order of preference; only the first code that actually exists (and is
// active) gets the hint.
const HINTS = [
  {
    codes: ["SFC", "FIN"],
    words: [
      "fee", "fees", "challan", "challans", "voucher", "vouchers", "payment", "payments", "paid", "pay",
      "refund", "refunds", "scholarship", "scholarships", "installment", "installments", "dues", "fine",
      "fines", "overcharged", "charged", "bank", "financial", "aid",
    ],
  },
  {
    codes: ["IT"],
    words: [
      "portal", "wifi", "internet", "password", "email", "emails", "lms", "login", "log", "account",
      "accounts", "website", "network", "computer", "lab", "printer", "cms", "outlook", "teams",
    ],
  },
  {
    codes: ["EXAM", "REG"],
    words: [
      "grade", "grades", "result", "results", "transcript", "transcripts", "exam", "exams",
      "examination", "marks", "gpa", "cgpa", "paper", "papers", "datesheet", "rechecking", "degree",
    ],
  },
  {
    codes: ["REG", "ACAD"],
    words: [
      "course", "courses", "registration", "enrollment", "enrolment", "enroll", "enrol", "drop",
      "withdraw", "withdrawal", "section", "sections", "timetable", "semester", "freeze", "credit",
      "credits",
    ],
  },
  {
    codes: ["ADMIN"],
    words: [
      "hostel", "transport", "bus", "buses", "cafeteria", "canteen", "parking", "security", "card",
      "maintenance", "washroom", "cleanliness", "ac", "classroom",
    ],
  },
];

export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Recent issue titles per department, one bounded indexed query each (no
// $push of every title), cached for 5 minutes.
const titlesCache = new Map(); // deptId → { at, titles }

// A new complaint should count straight away for its department.
export const forgetDepartmentTitles = (deptId) => titlesCache.delete(String(deptId));
export const clearDepartmentTitlesCache = () => titlesCache.clear();

async function recentTitles(deptId) {
  const key = String(deptId);
  const hit = titlesCache.get(key);
  if (hit && Date.now() - hit.at < TITLES_CACHE_MS) return hit.titles;
  const docs = await Issue.find({ department: deptId })
    .sort({ createdAt: -1 })
    .limit(RECENT_TITLES_PER_DEPT)
    .select("title")
    .lean();
  const titles = docs.map((d) => d.title || "");
  titlesCache.set(key, { at: Date.now(), titles });
  return titles;
}

// → { departmentId, code, name, score } | null
export async function suggestDepartment(text) {
  const words = new Set(tokenize(String(text ?? "").slice(0, MAX_TEXT_CHARS)));
  if (words.size === 0) return null;

  const departments = await Department.find({ isActive: true }).select("code name description").lean();
  if (departments.length === 0) return null;

  const titles = await Promise.all(departments.map((d) => recentTitles(d._id)));
  const titlesByDept = new Map(departments.map((d, i) => [String(d._id), titles[i]]));

  const profiles = departments.map((d) => ({
    dept: d,
    descriptor: new Set(tokenize(`${d.code} ${d.name} ${d.description || ""}`)),
    titles: new Set(tokenize((titlesByDept.get(String(d._id)) || []).join(" "))),
    hints: new Set(),
  }));

  const byCode = new Map(profiles.map((p) => [String(p.dept.code).toUpperCase(), p]));
  for (const hint of HINTS) {
    const target = hint.codes.map((c) => byCode.get(c)).find(Boolean);
    if (target) for (const w of hint.words) target.hints.add(w);
  }

  // A word every department shares (e.g. "university") can't tell them apart.
  const sharedByAll = (w) =>
    profiles.length > 1 && profiles.every((p) => p.descriptor.has(w) || p.titles.has(w));

  let best = null;
  let runnerUp = 0;
  for (const p of profiles) {
    let score = 0;
    for (const w of words) {
      if (p.hints.has(w)) score += HINT_WEIGHT;
      if (sharedByAll(w)) continue;
      if (p.descriptor.has(w)) score += DESCRIPTOR_WEIGHT;
      else if (p.titles.has(w)) score += TITLE_WEIGHT;
    }
    if (!best || score > best.score) {
      runnerUp = best ? best.score : 0;
      best = { p, score };
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  // Too weak, or a tie between departments → let the student choose.
  if (!best || best.score < MIN_SCORE || best.score === runnerUp) return null;
  return {
    departmentId: best.p.dept._id,
    code: best.p.dept.code,
    name: best.p.dept.name,
    score: best.score,
  };
}

// Does a chat message read like a personal complaint / problem report?
// Drives the "Register a complaint" highlight under the bot's reply. Kept
// narrow on purpose — ordinary questions ("What is the issue date of the fee
// voucher?") must not trigger it:
//   (a) an explicit complaint term, or
//   (b) a first-person marker (I / my / mera / mujhe …) AND a problem phrase
//       ("not working", "can't log in", "ghalat", …).
// Bare words like issue / problem / missing / failed / delay no longer count.
const EXPLICIT_COMPLAINT = [
  /\bcomplain(t|ts|ed|ing)?\b/,
  /\bshikay[ae]t\b/,
  /\brefunds?\b/,
  /\bover ?charged\b/,
  /\bcharged twice\b/,
  /\bdouble charged\b/,
  /\bharass(ment|ed|ing)?\b/,
  /\bnot fair\b/,
  /\bunfair(ly)?\b/,
];

const FIRST_PERSON = /\b(i|i'm|im|my|me|mine|mera|meri|mere|mujhe|main|hum|hamara|humara)\b/;

const PROBLEM_PHRASES = [
  /\bnot working\b/,
  /\bisn'?t working\b/,
  /\bdoesn'?t work\b/,
  /\bdoes not work\b/,
  /\b(can'?t|cannot) access\b/,
  /\b(can'?t|cannot) log ?in\b/,
  /\bunable to\b/,
  /\bnot showing\b/,
  /\bstill shows\b/,
  /\bshowing wrong\b/,
  /\bwrong (grade|grades|marks)\b/,
  /\berrors?\b/,
  /\bstuck\b/,
  /\bblocked\b/,
  /\bnot received\b/,
  /\bhaven'?t received\b/,
  /\bdidn'?t receive\b/,
  /\bkaam nahi?n?\b/,
  /\bnahi?n? ho raha\b/,
  /\bnahi?n? chal raha\b/,
  /\bghalat\b/,
  /\bgalat\b/,
  /\bmasla\b/,
];

export function looksLikeComplaint(text) {
  // Curly apostrophes (phone keyboards) count as straight ones.
  const t = String(text ?? "").toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (EXPLICIT_COMPLAINT.some((re) => re.test(t))) return true;
  return FIRST_PERSON.test(t) && PROBLEM_PHRASES.some((re) => re.test(t));
}
