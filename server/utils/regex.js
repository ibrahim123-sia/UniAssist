// Escape user input before putting it in a Mongo $regex, so "(" or "a+b"
// searches literally instead of throwing (500) or backtracking badly.
export const escapeRegex = (s) => String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
