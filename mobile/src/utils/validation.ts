// Mirrors the server's student-email rule: sp/fa + 2-digit intake year
// (20..current year + 1) + program + 4-digit roll @maju.edu.pk.
const MAJU_EMAIL_REGEX = /^(sp|fa)(\d{2})(bscs|bsai|bsse|bsbc)([0-9]{4})@maju\.edu\.pk$/i;
const MIN_INTAKE_YEAR = 20;

export const isStudentEmail = (email: string): boolean => {
  const m = email.trim().toLowerCase().match(MAJU_EMAIL_REGEX);
  if (!m) return false;
  const year = Number(m[2]);
  return year >= MIN_INTAKE_YEAR && year <= (new Date().getFullYear() % 100) + 1;
};

export const STUDENT_EMAIL_HINT = "Use your MAJU student email, e.g. sp23bscs0178@maju.edu.pk";

export const isEmail = (email: string) => /^[\w.-]+@([\w-]+\.)+[\w-]{2,24}$/.test(email.trim());
