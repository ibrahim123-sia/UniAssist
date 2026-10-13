import React from "react";
import { AlarmClock } from "lucide-react";
import { isOverdue } from "../utils/issues";

// Red "Overdue" pill for issues escalated past their department's SLA.
const OverdueBadge = ({ issue, isDark, className = "" }) => {
  if (!isOverdue(issue)) return null;
  const color = isDark ? "#F08D7B" : "#C0261D";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-semibold uppercase whitespace-nowrap ${className}`}
      style={{ backgroundColor: isDark ? "#3a1818" : "#FCE6E6", color }}
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
