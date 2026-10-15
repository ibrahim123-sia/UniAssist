import React from "react";
import { AlertTriangle } from "lucide-react";
import AdminModal from "./AdminModal";
import { C } from "../../theme/palette";

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
}) => {
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-control border transition-colors hover:bg-nav-hover! focus-ring disabled:opacity-50"
            style={{ borderColor: C.borderStrong, color: C.label, backgroundColor: C.surface }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded-control font-bold transition-colors focus-ring disabled:opacity-50 ${destructive ? "hover:brightness-95" : "hover:bg-primary-hover!"}`}
            style={{ backgroundColor: destructive ? C.danger : C.primary, color: destructive ? C.surface : C.onPrimary }}
          >
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: destructive ? C.dangerBg : C.warningBg, color: destructive ? C.danger : C.warning }}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm" style={{ color: C.text }}>
          {message}
        </p>
      </div>
    </AdminModal>
  );
};

export default ConfirmDialog;
