import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { MessageCircleQuestion, RefreshCw, Clock, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";
import moment from "moment";
import { fetchMyQuestions } from "../../redux/slices/questionSlice";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Waiting" },
  { key: "answered", label: "Answered" },
  { key: "dismissed", label: "Closed" },
];

const STATUS = {
  open: { label: "Waiting for admin", tone: "bg-warning-bg text-warning border-warning-border" },
  answered: { label: "Answered", tone: "bg-success-bg text-success border-success-border" },
  dismissed: { label: "Closed", tone: "bg-surface-muted text-muted border-border-strong" },
};

const MyQuestions = () => {
  const dispatch = useDispatch();
  const { myQuestions, loading, loaded, error } = useSelector((s) => s.question);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    dispatch(fetchMyQuestions());
  }, [dispatch]);

  const shown = filter === "all" ? myQuestions : myQuestions.filter((q) => q.status === filter);

  return (
    <div className="h-full overflow-y-auto bg-bg text-text">
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold text-heading">
            My Questions
          </h1>
          <p className="text-sm mt-1 text-muted">
            Questions sent to the university admin and their replies
          </p>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors focus-ring ${
                filter === f.key
                  ? "bg-primary border-primary text-on-primary"
                  : "bg-surface dark:bg-transparent border-border-strong text-pill hover:bg-nav-hover"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => dispatch(fetchMyQuestions())}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* A failed refresh keeps the last list but says so. */}
        {error && loaded && (
          <div
            role="alert"
            className="flex items-center gap-2 text-sm px-3 py-2 mb-3 rounded-control border bg-danger-bg border-danger-border text-danger"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {!loaded && loading ? (
          <div className="text-center py-12 text-muted">
            Loading…
          </div>
        ) : !loaded && error ? (
          <div
            role="alert"
            className="text-center py-12 border border-border bg-surface rounded-card shadow-card"
          >
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-danger" />
            <p className="text-base font-bold text-heading">
              Couldn&apos;t load your questions
            </p>
            <p className="text-sm mt-1 text-muted">
              {error}
            </p>
            <button
              onClick={() => dispatch(fetchMyQuestions())}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-control font-bold bg-primary text-on-primary hover:bg-primary-hover focus-ring disabled:bg-disabled-bg disabled:text-disabled-text transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div
            className="text-center py-16 border border-border bg-surface rounded-card shadow-card"
          >
            <MessageCircleQuestion className="w-12 h-12 mx-auto mb-3 text-muted" />
            <p className="text-base font-bold text-heading">
              {myQuestions.length === 0 ? "No questions yet" : "Nothing here"}
            </p>
            <p className="text-sm mt-1 text-muted">
              {myQuestions.length === 0 ? (
                <>
                  If the assistant can&apos;t help, use <strong>Ask an admin</strong> under its reply in{" "}
                  <Link to="/chat" className="font-semibold text-link hover:text-link-hover">
                    Chat
                  </Link>
                  .
                </>
              ) : (
                "No questions with this status."
              )}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((q) => {
              const st = STATUS[q.status] || STATUS.open;
              return (
                <li
                  key={q._id}
                  className="p-4 border space-y-2 bg-surface border-border rounded-card shadow-card"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase border ${st.tone}`}
                    >
                      {st.label}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {moment(q.createdAt).fromNow()}
                    </span>
                    {q.source === "auto" && <span>· forwarded automatically from chat</span>}
                  </div>
                  <p className="text-sm font-medium whitespace-pre-wrap wrap-break-word text-text">
                    {q.question}
                  </p>
                  {q.status === "answered" && q.adminAnswer ? (
                    <div
                      className="text-sm rounded-control px-3 py-2 border-l-4 bg-success-bg border-success text-text"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold mb-1 text-success">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        University admin
                        {q.answeredAt && (
                          <span className="font-normal text-muted">
                            · {moment(q.answeredAt).fromNow()}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap wrap-break-word">{q.adminAnswer}</p>
                    </div>
                  ) : q.status === "open" ? (
                    <p className="text-xs inline-flex items-center gap-1 text-muted">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Sent to the admin. You&apos;ll get a notification when they reply.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MyQuestions;
