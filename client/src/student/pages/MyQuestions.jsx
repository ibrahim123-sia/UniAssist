import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { MessageCircleQuestion, RefreshCw, Clock, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";
import moment from "moment";
import { fetchMyQuestions } from "../../redux/slices/questionSlice";
import { getPalette } from "../../administrator/utils/palette";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Waiting" },
  { key: "answered", label: "Answered" },
  { key: "dismissed", label: "Closed" },
];

const STATUS = {
  open: { label: "Waiting for admin", tone: "amber" },
  answered: { label: "Answered", tone: "green" },
  dismissed: { label: "Closed", tone: "muted" },
};

const MyQuestions = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const { myQuestions, loading, loaded, error } = useSelector((s) => s.question);
  const [filter, setFilter] = useState("all");
  const C = getPalette(theme === "dark");
  const bg = theme === "dark" ? "#0E1422" : "#F2F3F8";

  useEffect(() => {
    dispatch(fetchMyQuestions());
  }, [dispatch]);

  const shown = filter === "all" ? myQuestions : myQuestions.filter((q) => q.status === filter);

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: bg, color: C.text }}>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>
            My Questions
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            Questions sent to the university admin and their replies
          </p>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-2.5 py-1 rounded-full text-sm border transition-all"
              style={{
                borderColor: filter === f.key ? C.navy : C.border,
                backgroundColor: filter === f.key ? C.navy : "transparent",
                color: filter === f.key ? "#fff" : C.text,
              }}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => dispatch(fetchMyQuestions())}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border"
            style={{ borderColor: C.border, color: C.muted }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* A failed refresh keeps the last list but says so. */}
        {error && loaded && (
          <div
            role="alert"
            className="flex items-center gap-2 text-sm px-3 py-2 mb-3 rounded-lg border"
            style={{ borderColor: `${C.danger}55`, backgroundColor: `${C.danger}10`, color: C.danger }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {!loaded && loading ? (
          <div className="text-center py-12" style={{ color: C.muted }}>
            Loading…
          </div>
        ) : !loaded && error ? (
          <div
            role="alert"
            className="text-center py-12 rounded-xl border"
            style={{ borderColor: C.border, backgroundColor: C.surface }}
          >
            <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: C.danger }} />
            <p className="text-base font-medium" style={{ color: C.text }}>
              Couldn&apos;t load your questions
            </p>
            <p className="text-sm mt-1" style={{ color: C.muted }}>
              {error}
            </p>
            <button
              onClick={() => dispatch(fetchMyQuestions())}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: C.navy }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div
            className="text-center py-16 rounded-xl border"
            style={{ borderColor: C.border, backgroundColor: C.surface }}
          >
            <MessageCircleQuestion className="w-12 h-12 mx-auto mb-3" style={{ color: C.muted }} />
            <p className="text-base font-medium" style={{ color: C.text }}>
              {myQuestions.length === 0 ? "No questions yet" : "Nothing here"}
            </p>
            <p className="text-sm mt-1" style={{ color: C.muted }}>
              {myQuestions.length === 0 ? (
                <>
                  If the assistant can&apos;t help, use <strong>Ask an admin</strong> under its reply in{" "}
                  <Link to="/chat" style={{ color: C.navy }}>
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
              const color = C[st.tone];
              return (
                <li
                  key={q._id}
                  className="p-4 rounded-xl border space-y-2"
                  style={{ backgroundColor: C.surface, borderColor: C.border }}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
                    <span
                      className="px-2 py-0.5 rounded-full font-semibold uppercase"
                      style={{ backgroundColor: `${color}1A`, color }}
                    >
                      {st.label}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {moment(q.createdAt).fromNow()}
                    </span>
                    {q.source === "auto" && <span>· forwarded automatically from chat</span>}
                  </div>
                  <p className="text-sm font-medium whitespace-pre-wrap wrap-break-word" style={{ color: C.text }}>
                    {q.question}
                  </p>
                  {q.status === "answered" && q.adminAnswer ? (
                    <div
                      className="text-sm rounded-lg px-3 py-2 border-l-4"
                      style={{ backgroundColor: `${C.green}10`, borderColor: C.green, color: C.text }}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: C.green }}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        University admin
                        {q.answeredAt && (
                          <span className="font-normal" style={{ color: C.muted }}>
                            · {moment(q.answeredAt).fromNow()}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap wrap-break-word">{q.adminAnswer}</p>
                    </div>
                  ) : q.status === "open" ? (
                    <p className="text-xs inline-flex items-center gap-1" style={{ color: C.muted }}>
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
