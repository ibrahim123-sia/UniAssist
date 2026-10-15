import React from "react";
import { C, alpha } from "../../theme/palette";

const StatCard = ({ icon: Icon, label, value, accent, hint, loading }) => {
  const accentColor = accent || C.primary;

  return (
    <div
      className="rounded-card border p-4 flex flex-col gap-2"
      style={{ backgroundColor: C.surface, borderColor: C.border, boxShadow: C.shadowSm }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          {label}
        </span>
        {Icon && (
          <div
            className="w-9 h-9 rounded-control flex items-center justify-center"
            style={{ backgroundColor: alpha(accentColor, 12), color: accentColor }}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-2xl font-extrabold" style={{ color: C.heading }}>
        {loading ? (
          <span className="inline-block w-14 h-6 rounded animate-pulse" style={{ backgroundColor: C.surfaceMuted }} />
        ) : (
          value
        )}
      </div>
      {hint && (
        <p className="text-xs" style={{ color: C.muted }}>
          {hint}
        </p>
      )}
    </div>
  );
};

export default StatCard;
