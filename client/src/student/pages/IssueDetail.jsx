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
import { statusStyle } from "../../utils/issues";
import { C } from "../../theme/palette";

const MAX_REPLY_CHARS = 5000;
const MAX_FEEDBACK_CHARS = 1000;
const RATABLE_STATUSES = ["Resolved", "Closed"];

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

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
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
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
        <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-bg text-text">
          <p className="text-base font-bold text-heading">
            {notFound ? "Issue not found" : forbidden ? "You don't have access to this issue" : "Couldn't load this issue"}
          </p>
          <p className="text-sm text-muted">
            {notFound || forbidden ? issueError.message : `${issueError.message}. It will retry automatically.`}
          </p>
          <Link to="/issues" className="inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:text-link-hover focus-ring rounded">
            <ArrowLeft className="w-4 h-4" /> Back to issues
          </Link>
        </div>
      );
    }
    return (
      <div className="h-full flex items-center justify-center bg-bg text-muted">
        Loading…
      </div>
    );
  }

  const sStyle = statusStyle(issue.status);

  return (
    <div className="h-full overflow-y-auto bg-bg text-text">
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <Link to="/issues" className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted hover:text-text focus-ring rounded">
          <ArrowLeft className="w-4 h-4" /> Back to issues
        </Link>

        <div className="p-6 rounded-card border border-border bg-surface shadow-card mb-5">
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-heading">{issue.title}</h1>
            <span
              className="text-xs px-2.5 py-1 rounded-full uppercase font-bold border"
              style={{ backgroundColor: sStyle.bg, color: sStyle.text, borderColor: sStyle.border }}
            >
              {issue.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs mb-4 text-muted">
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
          <p className="text-sm whitespace-pre-wrap text-text">
            {issue.description}
          </p>

          {issue.attachments?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs font-semibold uppercase mb-2 text-muted">
                Attachments
              </div>
              <div className="flex flex-wrap gap-2">
                {issue.attachments.map((a, i) => (
                  <a
                    key={i}
                    href={`${SERVER_URL}${a.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-control border border-border-strong text-sm text-label bg-surface-muted hover:bg-nav-hover focus-ring"
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

        <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Conversation
        </div>

        <div className="space-y-3 mb-5">
          {issue.replies?.length === 0 && (
            <div className="text-sm text-center py-6 text-muted">
              No replies yet. The department will respond shortly.
            </div>
          )}
          {issue.replies?.map((r, i) => {
            const isStaff = r.authorRole === "staff";
            return (
              <div
                key={i}
                className={`p-4 rounded-card border border-l-4 ${
                  isStaff
                    ? "bg-nav-active-bg border-info-border border-l-primary"
                    : "bg-surface border-border border-l-border-strong"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 text-xs text-muted">
                  <span className={`font-semibold ${isStaff ? "text-nav-active-text" : "text-text"}`}>
                    {r.authorName} {isStaff && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary text-on-primary">STAFF</span>}
                  </span>
                  <span>{moment(r.createdAt).fromNow()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-text">{r.message}</p>
              </div>
            );
          })}
        </div>

        {issue.feedback?.rating ? (
          <div className="p-4 rounded-card border border-border bg-surface shadow-card mb-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Your feedback
              </span>
              {issue.feedback.submittedAt && (
                <span className="text-xs text-muted">
                  {moment(issue.feedback.submittedAt).format("MMM D, YYYY")}
                </span>
              )}
            </div>
            <div className="mt-1.5">
              <StarRating value={issue.feedback.rating} size={18} emptyColor={C.muted} />
            </div>
            {issue.feedback.comment && (
              <p className="text-sm whitespace-pre-wrap mt-2 text-text">
                {issue.feedback.comment}
              </p>
            )}
          </div>
        ) : (
          RATABLE_STATUSES.includes(issue.status) && (
            <form
              onSubmit={onSendFeedback}
              className="p-4 rounded-card border border-border bg-surface shadow-card mb-5 space-y-3"
            >
              <div>
                <p className="text-sm font-bold text-heading">How did the department handle this?</p>
                <p className="text-xs mt-0.5 text-muted">
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
                className="w-full px-3.5 py-2.5 rounded-control border text-sm resize-y bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sendingFeedback || !rating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-control text-sm font-bold bg-primary text-on-primary hover:bg-primary-hover focus-ring disabled:bg-disabled-bg disabled:text-disabled-text transition-colors"
                >
                  {sendingFeedback ? "Submitting…" : "Submit feedback"}
                </button>
              </div>
            </form>
          )
        )}

        {issue.status !== "Closed" && (
          <form onSubmit={onSendReply} className="p-4 rounded-card border border-border bg-surface shadow-card">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={MAX_REPLY_CHARS}
              rows={3}
              placeholder="Add a follow-up reply…"
              className="w-full px-3.5 py-2.5 rounded-control border text-sm resize-y bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
            />
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-control text-sm font-bold bg-primary text-on-primary hover:bg-primary-hover focus-ring disabled:bg-disabled-bg disabled:text-disabled-text transition-colors"
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
