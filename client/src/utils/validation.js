// Format: sp/fa + (20-26) + (bscs|bsai|bsse|bsbc) + (0000-9999) + @maju.edu.pk
const MAJU_EMAIL_REGEX =
  /^(sp|fa)(2[0-6])(bscs|bsai|bsse|bsbc)([0-9]{4})@maju\.edu\.pk$/i;

export const validateMajuEmail = (email) => {
  const trimmedEmail = email?.trim().toLowerCase();

  if (!trimmedEmail) {
    return { isValid: false, error: "Email is required" };
  }

  const match = trimmedEmail.match(MAJU_EMAIL_REGEX);

  if (!match) {
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
