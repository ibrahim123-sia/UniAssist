import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Send, FileText, Image as ImageIcon, Clock, User } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import {
  fetchDeptIssueById,
  addStaffReply,
  updateIssueStatus,
  clearSelectedIssue,
} from "../../redux/slices/issueSlice";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const STATUSES = ["Pending", "In Progress", "Resolved", "Closed"];

const statusStyle = (status, isDark) => {
  const palette = {
    Pending: { bg: isDark ? "#3a2f15" : "#FFF4E0", text: isDark ? "#FFC774" : "#9A6B00" },
    "In Progress": { bg: isDark ? "#13314f" : "#E0F0FF", text: isDark ? "#7BB6F5" : "#1463B0" },
    Resolved: { bg: isDark ? "#163320" : "#E0F8E5", text: isDark ? "#7BD594" : "#1B7A33" },
    Closed: { bg: isDark ? "#2a2a2a" : "#EDEDED", text: isDark ? "#B5B5B5" : "#666666" },
  };
  return palette[status] || palette.Closed;
};

const StaffIssueDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const issue = useSelector((s) => s.issue.selectedIssue);
  const theme = useSelector((s) => s.theme.theme);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const isDark = theme === "dark";

  const C = {
    bg: isDark ? "#0F1626" : "#F5F6F8",
    surface: isDark ? "#17203A" : "#FFFFFF",
    surfaceAlt: isDark ? "#1E2A47" : "#F5F6F8",
    input: isDark ? "#121A2E" : "#FFFFFF",
    border: isDark ? "#273350" : "#E2E5EA",
    text: isDark ? "#ECEEF3" : "#222222",
    muted: isDark ? "#A9B2C7" : "#5A6372",
    navy: isDark ? "#6E8BE0" : "#1E2E6E",
    red: isDark ? "#E57A63" : "#D0321E",
  };

  useEffect(() => {
    dispatch(fetchDeptIssueById(id));
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") dispatch(fetchDeptIssueById(id));
    }, 20000);
    return () => {
      clearInterval(interval);
      dispatch(clearSelectedIssue());
    };
  }, [dispatch, id]);

  const onSendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    const result = await dispatch(addStaffReply({ id, message: reply.trim() })).unwrap();
    setSending(false);
    if (result.success) {
      setReply("");
      toast.success("Reply sent to student");
    } else {
      toast.error(result.message || "Failed to send reply");
    }
  };

  const onStatusChange = async (newStatus) => {
    if (newStatus === issue.status) return;
    setUpdating(true);
    const result = await dispatch(updateIssueStatus({ id, status: newStatus })).unwrap();
    setUpdating(false);
    if (result.success) {
      toast.success(`Status changed to ${newStatus}`);
    } else {
      toast.error(result.message || "Failed to update status");
    }
  };

  if (!issue) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: C.bg, color: C.muted }}>
        Loading…
      </div>
    );
  }

  const sStyle = statusStyle(issue.status, isDark);

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: C.bg, color: C.text }}>
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <Link to="/staff/issues" className="inline-flex items-center gap-1.5 text-sm mb-5" style={{ color: C.muted }}>
          <ArrowLeft className="w-4 h-4" /> Back to inbox
        </Link>

        <div className="p-6 rounded-xl border mb-5" style={{ backgroundColor: C.surface, borderColor: C.border }}>
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <h1 className="text-2xl font-bold">{issue.title}</h1>
            <span
              className="text-xs px-2.5 py-1 rounded-full uppercase font-semibold"
              style={{ backgroundColor: sStyle.bg, color: sStyle.text }}
            >
              {issue.status}
            </span>
          </div>

          <div
            className="flex items-center gap-3 p-3 rounded-lg mb-4 text-sm"
            style={{ backgroundColor: C.surfaceAlt, color: C.text }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: C.navy }}
            >
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{issue.studentName}</div>
              <div className="text-xs truncate" style={{ color: C.muted }}>{issue.studentEmail}</div>
            </div>
            <div className="text-xs text-right" style={{ color: C.muted }}>
              <div>{issue.department?.code} · {issue.category}</div>
              <div className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {moment(issue.createdAt).format("MMM D, YYYY h:mm A")}
              </div>
            </div>
          </div>

          <p className="text-sm whitespace-pre-wrap">{issue.description}</p>

          {issue.attachments?.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: C.border }}>
              <div className="text-xs font-semibold uppercase mb-2" style={{ color: C.muted }}>
                Attachments
              </div>
              <div className="flex flex-wrap gap-2">
                {issue.attachments.map((a, i) => (
                  <a
                    key={i}
                    href={`${SERVER_URL}${a.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
                    style={{ borderColor: C.border, color: C.text, backgroundColor: C.surfaceAlt }}
                  >
                    {a.mimeType === "application/pdf" ? (
                      <FileText className="w-4 h-4" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                    {a.originalName}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl border mb-5" style={{ backgroundColor: C.surface, borderColor: C.border }}>
          <div className="text-xs font-semibold uppercase mb-2" style={{ color: C.muted }}>
            Update status
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map((s) => {
              const sty = statusStyle(s, isDark);
              const active = issue.status === s;
              return (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  disabled={updating || active}
                  className="px-3 py-1.5 rounded-full text-sm border font-medium transition-all disabled:opacity-60"
                  style={{
                    borderColor: active ? sty.text : C.border,
                    backgroundColor: active ? sty.bg : "transparent",
                    color: active ? sty.text : C.text,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          Conversation
        </div>

        <div className="space-y-3 mb-5">
          {issue.replies?.length === 0 && (
            <div className="text-sm text-center py-6" style={{ color: C.muted }}>
              No replies yet.
            </div>
          )}
          {issue.replies?.map((r, i) => {
            const isStaff = r.authorRole === "staff";
            return (
              <div
                key={i}
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: isStaff ? C.surfaceAlt : C.surface,
                  borderColor: isStaff ? C.navy : C.border,
                  borderLeft: `4px solid ${isStaff ? C.navy : C.red}`,
                }}
              >
                <div className="flex items-center justify-between mb-1.5 text-xs" style={{ color: C.muted }}>
                  <span className="font-semibold" style={{ color: isStaff ? C.navy : C.text }}>
                    {r.authorName} {isStaff && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: C.navy, color: "#fff" }}>STAFF</span>}
                  </span>
                  <span>{moment(r.createdAt).fromNow()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{r.message}</p>
              </div>
            );
          })}
        </div>

        <form onSubmit={onSendReply} className="p-4 rounded-xl border" style={{ backgroundColor: C.surface, borderColor: C.border }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Reply to the student…"
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-y"
            style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs" style={{ color: C.muted }}>
              Student is notified by email and in-app.
            </span>
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: C.navy }}
            >
              <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffIssueDetail;
