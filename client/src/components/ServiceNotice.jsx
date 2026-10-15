import React from "react";
import { MailWarning } from "lucide-react";

// Inline warning notice for a service-side problem the user can't fix by
// retrying (e.g. the university email isn't configured, so no OTP can be
// sent). Shown above the form instead of a disappearing toast.
// (Callers may still pass isDark; the tokens follow the theme on their own.)
const ServiceNotice = ({ message }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 text-sm rounded-control px-3 py-2 mb-4 border bg-warning-bg border-warning-border text-warning"
    >
      <MailWarning className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export default ServiceNotice;
