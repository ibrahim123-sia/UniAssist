import React from "react";
import { MailWarning } from "lucide-react";

// Inline amber notice for a service-side problem the user can't fix by
// retrying (e.g. the university email isn't configured, so no OTP can be
// sent). Shown above the form instead of a disappearing toast.
const ServiceNotice = ({ message, isDark }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 text-sm rounded-xl px-3 py-2 mb-4 border"
      style={{
        backgroundColor: isDark ? "rgba(224,180,76,0.10)" : "#FFF4E0",
        borderColor: isDark ? "rgba(224,180,76,0.35)" : "#F2D9A8",
        color: isDark ? "#E8C77A" : "#7A5300",
      }}
    >
      <MailWarning className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export default ServiceNotice;
