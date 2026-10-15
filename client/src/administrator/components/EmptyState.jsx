import React from "react";
import { C } from "../../theme/palette";

const EmptyState = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-12 h-12 mb-4" style={{ color: C.placeholder }} />}
      <h3 className="text-base font-bold mb-1" style={{ color: C.heading }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm max-w-md" style={{ color: C.muted }}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
