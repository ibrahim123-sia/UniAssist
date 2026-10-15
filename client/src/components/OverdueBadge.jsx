import React from "react";
import { AlarmClock } from "lucide-react";
import { isOverdue } from "../utils/issues";

// Danger-toned "Overdue" pill for issues escalated past their department's SLA.
// (Callers may still pass isDark; the tokens follow the theme on their own.)
const OverdueBadge = ({ issue, className = "" }) => {
  if (!isOverdue(issue)) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-semibold uppercase whitespace-nowrap border bg-danger-bg text-danger border-danger-border ${className}`}
      title={
        issue.escalatedAt
          ? `No staff response within the department's SLA — escalated ${new Date(issue.escalatedAt).toLocaleString()}`
          : "No staff response within the department's SLA"
      }
    >
      <AlarmClock className="w-3 h-3" />
      Overdue
    </span>
  );
};

export default OverdueBadge;
