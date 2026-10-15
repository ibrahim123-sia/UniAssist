import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { C } from "../../theme/palette";

const AdminModal = ({ open, onClose, title, children, footer, size = "md" }) => {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the dialog (first form field, else the first button) and
  // give it back to whatever opened it when the dialog closes.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const panel = panelRef.current;
    const target =
      panel?.querySelector("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])") ||
      panel?.querySelector("[data-autofocus], button:not([disabled])");
    target?.focus();
    return () => {
      if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: C.overlay }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${widths[size] || widths.md} rounded-panel border shadow-panel flex flex-col max-h-[90vh]`}
        style={{ backgroundColor: C.surface, borderColor: C.border, color: C.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
          <h3 id={titleId} className="text-lg font-bold" style={{ color: C.heading }}>{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-nav-hover focus-ring"
            style={{ color: C.label }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: C.border }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModal;
