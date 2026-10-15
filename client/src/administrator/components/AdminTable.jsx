import React from "react";
import { C } from "../../theme/palette";

const AdminTable = ({ columns, children, dense = false }) => {
  return (
    <div
      className="rounded-card border overflow-hidden"
      style={{ borderColor: C.border, backgroundColor: C.surface, boxShadow: C.shadowSm }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: C.tableHeader }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left font-semibold ${dense ? "px-3 py-2" : "px-4 py-3"} text-xs uppercase tracking-wide`}
                  style={{ color: C.muted, width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          {children}
        </table>
      </div>
    </div>
  );
};

export const AdminTableRow = ({ children, onClick, highlight }) => {
  // Clickable rows are keyboard operable: focusable, Enter/Space activate.
  const onKeyDown = onClick
    ? (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e);
        }
      }
    : undefined;
  return (
    <tr
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      className={`border-t transition-colors ${onClick ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" : ""}`}
      style={{ borderColor: C.border, backgroundColor: highlight ? C.warningBg : "transparent" }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.backgroundColor = C.rowHover)}
      onMouseLeave={(e) =>
        onClick && (e.currentTarget.style.backgroundColor = highlight ? C.warningBg : "transparent")
      }
    >
      {children}
    </tr>
  );
};

export const AdminTableCell = ({ children, dense = false, className = "", style }) => (
  <td className={`${dense ? "px-3 py-2" : "px-4 py-3"} ${className}`} style={style}>
    {children}
  </td>
);

export default AdminTable;
