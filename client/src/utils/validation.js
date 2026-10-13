// Format: sp/fa + 2-digit year + (bscs|bsai|bsse|bsbc) + (0000-9999) + @maju.edu.pk
// The year must be 20..(current 2-digit year + 1), matching the server, so
// next year's intake can register without a code change.
const MAJU_EMAIL_REGEX =
  /^(sp|fa)(\d{2})(bscs|bsai|bsse|bsbc)([0-9]{4})@maju\.edu\.pk$/i;
const MIN_INTAKE_YEAR = 20;

export const validateMajuEmail = (email) => {
  const trimmedEmail = email?.trim().toLowerCase();

  if (!trimmedEmail) {
    return { isValid: false, error: "Email is required" };
  }

  const match = trimmedEmail.match(MAJU_EMAIL_REGEX);
  const year = match ? Number(match[2]) : NaN;
  const maxYear = (new Date().getFullYear() % 100) + 1;

  if (!match || year < MIN_INTAKE_YEAR || year > maxYear) {
    return {
      isValid: false,
      error: "Use format: sp23bscs0178@maju.edu.pk",
    };
  }

  return {
    isValid: true,
    email: trimmedEmail,
  };
};
