import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Send, Paperclip, FileText, Image as ImageIcon, Clock, MessageSquare } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import {
  fetchIssueById,
  addStudentReply,
  clearSelectedIssue,
  submitIssueFeedback,
} from "../../redux/slices/issueSlice";
import StarRating from "../../components/StarRating";

const MAX_REPLY_CHARS = 5000;
const MAX_FEEDBACK_CHARS = 1000;
const RATABLE_STATUSES = ["Resolved", "Closed"];

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const statusStyle = (status, isDark) => {
  const palette = {
    Pending: { bg: isDark ? "#3a2f15" : "#FFF4E0", text: isDark ? "#FFC774" : "#9A6B00" },
    "In Progress": { bg: isDark ? "#13314f" : "#E0F0FF", text: isDark ? "#7BB6F5" : "#1463B0" },
    Resolved: { bg: isDark ? "#163320" : "#E0F8E5", text: isDark ? "#7BD594" : "#1B7A33" },
    Closed: { bg: isDark ? "#2a2a2a" : "#EDEDED", text: isDark ? "#B5B5B5" : "#666666" },
  };
  return palette[status] || palette.Closed;
};

const IssueDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  // Only trust state for the issue in the URL; a previous page's issue may
  // still be in the store for a moment after navigating.
  const issue = useSelector((s) =>
    s.issue.selectedIssue?._id === id ? s.issue.selectedIssue : null
  );
  const issueError = useSelector((s) =>
    s.issue.issueError?.id === id ? s.issue.issueError : null
  );
  const theme = useSelector((s) => s.theme.theme);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const isDark = theme === "dark";

  const C = {
    bg: isDark ? "#0E1422" : "#F2F3F8",
    surface: isDark ? "#16203A" : "#FFFFFF",
    surfaceAlt: isDark ? "#1E2A47" : "#F2F3F8",
    input: isDark ? "#0B1120" : "#FFFFFF",
    border: isDark ? "#2A3656" : "#D8DAE6",
    text: isDark ? "#ECEEF5" : "#1F2330",
    muted: isDark ? "#9AA5BD" : "#5A6372",
    navy: isDark ? "#E63027" : "#1E2A66",
    red: isDark ? "#C48A4A" : "#E63027",
  };

  useEffect(() => {
    dispatch(fetchIssueById(id));
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") dispatch(fetchIssueById(id));
    }, 20000);
    return () => {
      clearInterval(interval);
      dispatch(clearSelectedIssue());
    };
  }, [dispatch, id]);

  const onSendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    if (reply.trim().length > MAX_REPLY_CHARS) {
      toast.error(`Reply is too long (max ${MAX_REPLY_CHARS} characters).`);
      return;
    }
    setSending(true);
    const result = await dispatch(addStudentReply({ id, message: reply.trim() })).unwrap();
    setSending(false);
    if (result.success) {
      setReply("");
      toast.success("Reply added");
    } else {
      toast.error(result.message || "Failed to send reply");
    }
  };

  const onSendFeedback = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error("Pick a rating from 1 to 5 stars.");
      return;
    }
    setSendingFeedback(true);
    const result = await dispatch(
      submitIssueFeedback({ id, rating, comment: feedbackComment.trim() })
    ).unwrap();
    setSendingFeedback(false);
    if (result.success) {
      toast.success("Thanks for your feedback");
    } else {
      toast.error(result.message || "Failed to submit your feedback");
      // 409 = already rated (e.g. from another tab); show the saved rating.
      if (result.status === 409 || result.status === 400) dispatch(fetchIssueById(id));
    }
  };

  if (!issue) {
    if (issueError) {
      const notFound = issueError.status === 404;
      const forbidden = issueError.status === 403;
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ backgroundColor: C.bg, color: C.text }}>
          <p className="text-base font-semibold">
            {notFound ? "Issue not found" : forbidden ? "You don't have access to this issue" : "Couldn't load this issue"}
          </p>
          <p className="text-sm" style={{ color: C.muted }}>
            {notFound || forbidden ? issueError.message : `${issueError.message}. It will retry automatically.`}
          </p>
          <Link to="/issues" className="inline-flex items-center gap-1.5 text-sm" style={{ color: C.navy }}>
            <ArrowLeft className="w-4 h-4" /> Back to issues
          </Link>
        </div>
      );
    }
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
        <Link to="/issues" className="inline-flex items-center gap-1.5 text-sm mb-5" style={{ color: C.muted }}>
          <ArrowLeft className="w-4 h-4" /> Back to issues
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
          <div className="flex items-center gap-4 text-xs mb-4" style={{ color: C.muted }}>
            <span>{issue.department?.code} — {issue.department?.name}</span>
            <span>Category: {issue.category}</span>
            {issue.source === "chatbot" && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> From chat
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {moment(issue.createdAt).format("MMM D, YYYY h:mm A")}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap" style={{ color: C.text }}>
            {issue.description}
          </p>

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

        <div className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          Conversation
        </div>

        <div className="space-y-3 mb-5">
          {issue.replies?.length === 0 && (
            <div className="text-sm text-center py-6" style={{ color: C.muted }}>
              No replies yet. The department will respond shortly.
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
                <p className="text-sm whitespace-pre-wrap" style={{ color: C.text }}>{r.message}</p>
              </div>
            );
          })}
        </div>

        {issue.feedback?.rating ? (
          <div className="p-4 rounded-xl border mb-5" style={{ backgroundColor: C.surface, borderColor: C.border }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
                Your feedback
              </span>
              {issue.feedback.submittedAt && (
                <span className="text-xs" style={{ color: C.muted }}>
                  {moment(issue.feedback.submittedAt).format("MMM D, YYYY")}
                </span>
              )}
            </div>
            <div className="mt-1.5">
              <StarRating value={issue.feedback.rating} size={18} emptyColor={C.muted} />
            </div>
            {issue.feedback.comment && (
              <p className="text-sm whitespace-pre-wrap mt-2" style={{ color: C.text }}>
                {issue.feedback.comment}
              </p>
            )}
          </div>
        ) : (
          RATABLE_STATUSES.includes(issue.status) && (
            <form
              onSubmit={onSendFeedback}
              className="p-4 rounded-xl border mb-5 space-y-3"
              style={{ backgroundColor: C.surface, borderColor: C.border }}
            >
              <div>
                <p className="text-sm font-semibold">How did the department handle this?</p>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                  Your rating helps the university improve. You can rate once.
                </p>
              </div>
              <StarRating value={rating} onChange={setRating} size={26} emptyColor={C.muted} disabled={sendingFeedback} />
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                maxLength={MAX_FEEDBACK_CHARS}
                rows={2}
                placeholder="Anything to add? (optional)"
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-y"
                style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sendingFeedback || !rating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                  style={{ backgroundColor: C.navy }}
                >
                  {sendingFeedback ? "Submitting…" : "Submit feedback"}
                </button>
              </div>
            </form>
          )
        )}

        {issue.status !== "Closed" && (
          <form onSubmit={onSendReply} className="p-4 rounded-xl border" style={{ backgroundColor: C.surface, borderColor: C.border }}>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={MAX_REPLY_CHARS}
              rows={3}
              placeholder="Add a follow-up reply…"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-y"
              style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
            />
            <div className="flex justify-end mt-3">
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
        )}
      </div>
    </div>
  );
};

export default IssueDetail;
