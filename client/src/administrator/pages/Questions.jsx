import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  MessageCircleQuestion,
  Bot,
  User,
  Reply,
  XCircle,
  Trash2,
  Database,
  AlertTriangle,
  CheckCircle2,
  Layers,
  List,
  ChevronDown,
  ChevronRight,
  Info,
  RefreshCw,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import {
  fetchAdminQuestions,
  answerQuestion,
  dismissQuestion,
  deleteQuestion,
  fetchQuestionGroups,
  answerQuestionGroup,
  dismissQuestionGroup,
} from "../../redux/slices/adminQuestionSlice";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import AdminModal from "../components/AdminModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { getPalette } from "../utils/palette";
import { useDebouncedSearch } from "../utils/useDebouncedSearch";
import { ProgressLine } from "../../components/ProgressSteps";

const PAGE_SIZE = 20;
const MAX_ANSWER = 4000;
// answer-group / dismiss-group accept at most this many ids per request.
const GROUP_BATCH = 200;

const VIEWS = [
  { key: "grouped", label: "Grouped", icon: Layers },
  { key: "list", label: "List", icon: List },
];

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Answering is one request, but with "add to knowledge base" the server also
// embeds the Q&A — after this long the button says so.
const KB_PHASE_AFTER_MS = 1500;

const STATUS_TABS = [
  { key: "open", label: "Open" },
  { key: "answered", label: "Answered" },
  { key: "dismissed", label: "Dismissed" },
];

const SOURCES = [
  { key: "", label: "All sources" },
  { key: "auto", label: "Auto-captured" },
  { key: "student", label: "Asked by student" },
];

const askerLabel = (q) => {
  if (q.isGuest) return "Guest";
  const name = q.askerName || q.askedBy?.name;
  const email = q.askerEmail || q.askedBy?.email;
  if (name && email) return `${name} · ${email}`;
  return name || email || "Unknown user";
};

// Only signed-in askers get the "question answered" notification.
const notifiable = (q) => !q.isGuest && !!(q.askedBy || q.askerEmail);

const BotAnswer = ({ text, C }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const long = text.length > 220;
  return (
    <div className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: C.surfaceAlt, color: C.muted }}>
      <div className="flex items-center gap-1.5 font-medium mb-0.5">
        <Bot className="w-3.5 h-3.5" /> Chatbot replied
      </div>
      <p className={`whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}>{text}</p>
      {long && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 font-medium"
          style={{ color: C.navy }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};

// One cluster of similar questions: representative text, how often and by
// how many people it was asked, and the individual questions on expand.
const QuestionGroup = ({ group, C, canAct, submitting, onAnswer, onDismiss }) => {
  const [open, setOpen] = useState(false);
  const count = group.count ?? group.ids?.length ?? 1;
  const askers = group.askers ?? 0;
  const sources = group.sources || {};
  const actionBtn = "px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1 disabled:opacity-50";
  const chips = [
    { key: "student", label: "Student", n: sources.student, color: C.navy },
    { key: "auto", label: "Auto", n: sources.auto, color: C.amber },
  ].filter((c) => c.n);

  return (
    <li className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: C.surface, borderColor: C.border }}>
      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
        <span
          className="px-2 py-0.5 rounded-full font-semibold"
          style={{ backgroundColor: count > 1 ? `${C.red}1A` : C.surfaceAlt, color: count > 1 ? C.red : C.muted }}
        >
          ×{count}
        </span>
        <span>
          Asked {plural(count, "time")}
          {askers > 0 && ` by ${plural(askers, "person", "people")}`}
        </span>
        {group.latestAt && (
          <span title={moment(group.latestAt).format("MMM D, YYYY h:mm A")}>
            · latest {moment(group.latestAt).fromNow()}
          </span>
        )}
        {chips.map((c) => (
          <span
            key={c.key}
            className="px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: `${c.color}1A`, color: c.color }}
          >
            {c.label} {c.n}
          </span>
        ))}
        {canAct && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => onAnswer(group)}
              disabled={submitting}
              className={`${actionBtn} font-medium text-white`}
              style={{ backgroundColor: C.navy, borderColor: C.navy }}
            >
              <Reply className="w-3.5 h-3.5" /> {count > 1 ? "Answer all" : "Answer"}
            </button>
            <button
              onClick={() => onDismiss(group)}
              disabled={submitting}
              className={actionBtn}
              style={{ borderColor: C.border, color: C.text }}
            >
              <XCircle className="w-3.5 h-3.5" /> {count > 1 ? "Dismiss all" : "Dismiss"}
            </button>
          </div>
        )}
      </div>

      <p className="text-sm font-medium whitespace-pre-wrap wrap-break-word" style={{ color: C.text }}>
        {group.representative?.question}
      </p>

      {group.questions?.length > 0 && (
        <div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium inline-flex items-center gap-1"
            style={{ color: C.navy }}
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {open ? "Hide" : "Show"} {plural(group.questions.length, "question")}
          </button>
          {open && (
            <ul className="mt-2 space-y-1.5 border-l-2 pl-3" style={{ borderColor: C.border }}>
              {group.questions.map((q) => (
                <li key={q._id} className="text-sm">
                  <p className="whitespace-pre-wrap wrap-break-word" style={{ color: C.text }}>
                    {q.question}
                  </p>
                  <p className="text-xs" style={{ color: C.muted }}>
                    {q.isGuest ? "Guest" : q.askerName || "Unknown user"}
                    {q.createdAt && ` · ${moment(q.createdAt).fromNow()}`}
                    {q.status && q.status !== "open" && ` · ${q.status}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

const Questions = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const C = getPalette(theme === "dark");
  const {
    questions,
    total,
    counts,
    loading,
    error,
    submitting,
    groups,
    grouping,
    groupsLoading,
    groupsError,
  } = useSelector((s) => s.adminQuestion);

  const [status, setStatus] = useState("open");
  // Grouped is the default for Open, where admins answer in bulk.
  const [view, setView] = useState("grouped");
  const grouped = view === "grouped";
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const { input: searchInput, setInput: setSearchInput, search } = useDebouncedSearch(() => setPage(1));

  const [answering, setAnswering] = useState(null);
  // Group being answered with "Answer all" (null when answering one question).
  const [answeringGroup, setAnsweringGroup] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [addToKB, setAddToKB] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // { q } for one question, { group } for "Dismiss all".
  const [confirmDismiss, setConfirmDismiss] = useState(null);
  // null | "saving" | "kb" — drives the answer button label.
  const [answerPhase, setAnswerPhase] = useState(null);
  const phaseTimerRef = useRef(null);
  const [groupsStartedAt, setGroupsStartedAt] = useState(null);

  useEffect(() => () => clearTimeout(phaseTimerRef.current), []);

  const startAnswerPhase = (withKB) => {
    clearTimeout(phaseTimerRef.current);
    setAnswerPhase("saving");
    if (withKB) phaseTimerRef.current = setTimeout(() => setAnswerPhase("kb"), KB_PHASE_AFTER_MS);
  };
  const endAnswerPhase = () => {
    clearTimeout(phaseTimerRef.current);
    setAnswerPhase(null);
  };

  // The list request also refreshes the tab counts, so it still runs (for a
  // single row) while the grouped view is showing.
  const listSearch = grouped ? "" : search;
  const listPage = grouped ? 1 : page;
  const query = useMemo(
    () => ({
      status,
      source,
      search: listSearch,
      limit: grouped ? 1 : PAGE_SIZE,
      offset: (listPage - 1) * PAGE_SIZE,
    }),
    [status, source, listSearch, listPage, grouped]
  );

  useEffect(() => {
    dispatch(fetchAdminQuestions(query));
  }, [dispatch, query]);

  // Grouping embeds every question on the AI service, so it can take a few
  // seconds; the placeholder (shown only while loading) counts from the
  // latest request.
  const loadGroups = useCallback(() => {
    setGroupsStartedAt(Date.now());
    dispatch(fetchQuestionGroups({ status, source }));
  }, [dispatch, status, source]);

  useEffect(() => {
    if (grouped) loadGroups();
  }, [grouped, loadGroups]);

  // Groups arrive all at once; search and paging happen here.
  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((g) =>
      [g.representative?.question, ...(g.questions || []).map((q) => q.question)].some((t) =>
        (t || "").toLowerCase().includes(term)
      )
    );
  }, [groups, search]);
  const pagedGroups = visibleGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Acting on a question moves it out of the current tab; step back a page
  // when that empties the last one instead of showing a blank page.
  const afterAction = () => {
    if (grouped) {
      if (pagedGroups.length === 1 && page > 1) setPage(page - 1);
      loadGroups();
      dispatch(fetchAdminQuestions(query));
      return;
    }
    if (questions.length === 1 && page > 1) setPage(page - 1);
    else dispatch(fetchAdminQuestions(query));
  };

  const openAnswer = (q) => {
    setAnsweringGroup(null);
    setAnswering(q);
    setAnswerText(q.adminAnswer || "");
    setAddToKB(true);
  };

  const openGroupAnswer = (group) => {
    setAnsweringGroup(group);
    setAnswering({ _id: group.representative?._id, question: group.representative?.question || "" });
    setAnswerText("");
    setAddToKB(true);
  };

  const closeAnswer = () => {
    if (submitting) return;
    setAnswering(null);
    setAnsweringGroup(null);
  };

  // The server's kbError is already a full sentence — show it as is.
  const toastKbResult = (saved, kbError, triedKB) => {
    if (kbError) {
      toast(`${saved}. ${kbError}`, {
        icon: <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: C.amber }} />,
        duration: 7000,
      });
    } else {
      toast.success(triedKB ? `${saved} and added to the knowledge base` : saved);
    }
  };

  // Batches of GROUP_BATCH ids. The KB entry rides on the first batch that
  // actually answers something (a batch whose questions were all answered
  // meanwhile by another admin answers 0), so it's created exactly once.
  const doAnswerGroup = async (answer) => {
    const batches = chunk(answeringGroup.ids || [], GROUP_BATCH);
    let answered = 0;
    let kbError = null;
    let kbPending = addToKB;
    let kbTried = false;
    for (let i = 0; i < batches.length; i += 1) {
      const result = await dispatch(
        answerQuestionGroup({ ids: batches[i], answer, addToKB: kbPending })
      ).unwrap();
      if (!result.success) {
        toast.error(
          answered
            ? `Answered ${plural(answered, "question")}, then failed: ${result.message}`
            : result.message || "Failed to save the answer"
        );
        if (answered) {
          setAnswering(null);
          setAnsweringGroup(null);
          afterAction();
        }
        return;
      }
      const n = result.answered ?? batches[i].length;
      answered += n;
      if (kbPending && n > 0) {
        kbPending = false;
        kbTried = true;
        kbError = result.kbError || null;
      }
    }
    if (answered === 0) {
      toast("These questions were already answered or dismissed", { icon: <Info className="w-4 h-4" /> });
    } else {
      toastKbResult(`Answered ${plural(answered, "question")}`, kbError, kbTried);
    }
    setAnswering(null);
    setAnsweringGroup(null);
    afterAction();
  };

  const doDismissGroup = async (group) => {
    let dismissed = 0;
    for (const ids of chunk(group.ids || [], GROUP_BATCH)) {
      const result = await dispatch(dismissQuestionGroup(ids)).unwrap();
      if (!result.success) {
        toast.error(result.message || "Failed to dismiss");
        if (dismissed) afterAction();
        return;
      }
      dismissed += result.dismissed ?? ids.length;
    }
    toast.success(dismissed === 1 ? "Question dismissed" : `Dismissed ${dismissed} questions`);
    afterAction();
  };

  const doAnswer = async (e) => {
    e.preventDefault();
    const answer = answerText.trim();
    if (!answer) {
      toast.error("Write an answer first");
      return;
    }
    startAnswerPhase(addToKB);
    try {
      if (answeringGroup) {
        await doAnswerGroup(answer);
        return;
      }
      const result = await dispatch(answerQuestion({ id: answering._id, answer, addToKB })).unwrap();
      if (!result.success) {
        toast.error(result.message || "Failed to save the answer");
        return;
      }
      const saved =
        answering.status === "answered"
          ? "Answer updated"
          : notifiable(answering)
          ? "Answer sent to the student"
          : "Answer saved";
      toastKbResult(saved, result.kbError, addToKB);
      setAnswering(null);
      afterAction();
    } finally {
      endAnswerPhase();
    }
  };

  const doDismiss = async (q) => {
    const result = await dispatch(dismissQuestion(q._id)).unwrap();
    if (result.success) {
      toast.success("Question dismissed");
      afterAction();
    } else {
      toast.error(result.message || "Failed to dismiss");
    }
  };

  const doConfirmDismiss = async () => {
    const target = confirmDismiss;
    if (!target) return;
    if (target.group) await doDismissGroup(target.group);
    else await doDismiss(target.q);
    setConfirmDismiss(null);
  };

  const doDelete = async () => {
    const result = await dispatch(deleteQuestion(confirmDelete._id)).unwrap();
    if (result.success) {
      toast.success("Question deleted");
      setConfirmDelete(null);
      afterAction();
    } else {
      toast.error(result.message || "Failed to delete");
    }
  };

  const actionBtn = "px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1 disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => {
          const active = status === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setStatus(t.key);
                setView(t.key === "open" ? "grouped" : "list");
                setPage(1);
              }}
              className="px-3 py-2 text-sm rounded-lg border flex items-center gap-2 transition-colors"
              style={{
                backgroundColor: active ? C.navy : C.surface,
                color: active ? "#fff" : C.text,
                borderColor: active ? C.navy : C.border,
              }}
            >
              {t.label}
              <span
                className="min-w-[20px] px-1.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: active ? "rgba(255,255,255,0.2)" : C.surfaceAlt,
                  color: active ? "#fff" : C.muted,
                }}
              >
                {counts?.[t.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border focus:outline-none"
            style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
          />
        </div>
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm rounded-lg border focus:outline-none"
          style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
        >
          {SOURCES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.key;
            return (
              <button
                key={v.key}
                onClick={() => {
                  setView(v.key);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm flex items-center gap-1.5 transition-colors"
                style={{ backgroundColor: active ? C.navy : C.surface, color: active ? "#fff" : C.text }}
                title={v.key === "grouped" ? "Group similar questions together" : "Every question on its own"}
              >
                <Icon className="w-4 h-4" />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {grouped && grouping === "exact" && groups.length > 0 && (
        <p
          className="text-xs px-3 py-2 rounded-lg border flex items-start gap-2"
          style={{ borderColor: C.border, backgroundColor: C.surfaceAlt, color: C.muted }}
        >
          <Info className="w-3.5 h-3.5 mt-px shrink-0" />
          The similarity service is unavailable right now, so only questions with the same wording are grouped.
        </p>
      )}

      {grouped ? (
        groupsLoading && groups.length === 0 ? (
          <div className="space-y-3">
            <ProgressLine label="Grouping similar questions…" startedAt={groupsStartedAt} />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl border animate-pulse"
                style={{ backgroundColor: C.surface, borderColor: C.border }}
              />
            ))}
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="rounded-xl border" style={{ backgroundColor: C.surface, borderColor: C.border }}>
            <EmptyState
              icon={groupsError ? AlertTriangle : MessageCircleQuestion}
              title={groupsError ? "Couldn't load grouped questions" : `No ${status} questions`}
              action={
                groupsError ? (
                  <button
                    onClick={loadGroups}
                    className="px-3 py-1.5 text-sm rounded-lg border inline-flex items-center gap-1.5"
                    style={{ borderColor: C.border, color: C.text }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Try again
                  </button>
                ) : undefined
              }
              description={
                groupsError
                  ? `${groupsError}. Switch to List to see questions one by one.`
                  : search || source
                  ? "Try a different search or filter."
                  : status === "open"
                  ? "Questions the chatbot couldn't answer, and ones students send to you, show up here."
                  : undefined
              }
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {groupsLoading && (
              <li>
                <ProgressLine label="Grouping similar questions…" startedAt={groupsStartedAt} />
              </li>
            )}
            {groupsError && !groupsLoading && (
              <li className="text-xs flex items-center gap-1.5" style={{ color: C.danger }} role="alert">
                <AlertTriangle className="w-3.5 h-3.5" /> Couldn&apos;t refresh the groups: {groupsError}
              </li>
            )}
            {pagedGroups.map((g) => (
              <QuestionGroup
                key={g.representative?._id || g.ids?.[0]}
                group={g}
                C={C}
                canAct={status === "open"}
                submitting={submitting}
                onAnswer={openGroupAnswer}
                onDismiss={(group) => setConfirmDismiss({ group })}
              />
            ))}
          </ul>
        )
      ) : loading && questions.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border animate-pulse"
              style={{ backgroundColor: C.surface, borderColor: C.border }}
            />
          ))}
        </div>
      ) : error && questions.length === 0 ? (
        <div className="rounded-xl border" style={{ backgroundColor: C.surface, borderColor: C.border }} role="alert">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load questions"
            description={error}
            action={
              <button
                onClick={() => dispatch(fetchAdminQuestions(query))}
                disabled={loading}
                className="px-3 py-1.5 text-sm rounded-lg border inline-flex items-center gap-1.5 disabled:opacity-50"
                style={{ borderColor: C.border, color: C.text }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Try again
              </button>
            }
          />
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border" style={{ backgroundColor: C.surface, borderColor: C.border }}>
          <EmptyState
            icon={MessageCircleQuestion}
            title={`No ${status} questions`}
            description={
              search || source
                ? "Try a different search or filter."
                : status === "open"
                ? "Questions the chatbot couldn't answer, and ones students send to you, show up here."
                : undefined
            }
          />
        </div>
      ) : (
        <ul className="space-y-3" style={{ opacity: loading ? 0.6 : 1 }}>
          {error && !loading && (
            <li className="text-xs flex items-center gap-1.5" style={{ color: C.danger }} role="alert">
              <AlertTriangle className="w-3.5 h-3.5" /> Couldn&apos;t refresh the list: {error}
            </li>
          )}
          {questions.map((q) => {
            const fromStudent = q.source === "student";
            const badgeColor = fromStudent ? C.navy : C.amber;
            return (
              <li
                key={q._id}
                className="rounded-xl border p-4 space-y-2"
                style={{ backgroundColor: C.surface, borderColor: C.border }}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
                  <span
                    className="px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${badgeColor}1A`, color: badgeColor }}
                    title={
                      fromStudent
                        ? "The student asked for an admin with “Ask an admin”"
                        : "Captured automatically: the chatbot couldn't answer"
                    }
                  >
                    {fromStudent ? "Student" : "Auto"}
                  </span>
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{askerLabel(q)}</span>
                  </span>
                  <span title={moment(q.createdAt).format("MMM D, YYYY h:mm A")}>
                    · {moment(q.createdAt).fromNow()}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {q.status !== "answered" ? (
                      <button
                        onClick={() => openAnswer(q)}
                        disabled={submitting}
                        className={`${actionBtn} font-medium text-white`}
                        style={{ backgroundColor: C.navy, borderColor: C.navy }}
                      >
                        <Reply className="w-3.5 h-3.5" /> Answer
                      </button>
                    ) : (
                      <button
                        onClick={() => openAnswer(q)}
                        disabled={submitting}
                        className={actionBtn}
                        style={{ borderColor: C.border, color: C.text }}
                        title="Edit the answer (the student is notified again only if it changes)"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit answer
                      </button>
                    )}
                    {q.status === "open" && (
                      <button
                        onClick={() => setConfirmDismiss({ q })}
                        disabled={submitting}
                        className={actionBtn}
                        style={{ borderColor: C.border, color: C.text }}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(q)}
                      disabled={submitting}
                      className="p-1.5 rounded transition-colors disabled:opacity-50"
                      style={{ color: C.muted }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
                      aria-label="Delete question"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-medium whitespace-pre-wrap wrap-break-word" style={{ color: C.text }}>
                  {q.question}
                </p>

                <BotAnswer text={q.botAnswer} C={C} />

                {q.status === "answered" && q.adminAnswer && (
                  <div
                    className="text-sm rounded-lg px-3 py-2 border-l-4"
                    style={{ backgroundColor: `${C.green}10`, borderColor: C.green, color: C.text }}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs mb-1" style={{ color: C.muted }}>
                      <span className="inline-flex items-center gap-1 font-medium" style={{ color: C.green }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Answered
                      </span>
                      {q.answeredBy?.name && <span>by {q.answeredBy.name}</span>}
                      {q.answeredAt && <span>· {moment(q.answeredAt).fromNow()}</span>}
                      {q.addedToKB && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${C.navy}1A`, color: C.navy }}
                        >
                          <Database className="w-3 h-3" /> In knowledge base
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap wrap-break-word">{q.adminAnswer}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={grouped ? visibleGroups.length : total}
        onChange={setPage}
      />

      <AdminModal
        open={!!answering}
        onClose={closeAnswer}
        title={
          answeringGroup && (answeringGroup.ids?.length || 0) > 1
            ? "Answer all similar questions"
            : answering?.status === "answered"
            ? "Edit answer"
            : "Answer question"
        }
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeAnswer}
              disabled={submitting}
              className="px-3 py-2 text-sm rounded-lg border disabled:opacity-50"
              style={{ borderColor: C.border, color: C.text }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="answer-question-form"
              disabled={submitting || !answerText.trim()}
              className="px-3 py-2 text-sm rounded-lg font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: C.navy }}
            >
              {answerPhase === "kb"
                ? "Adding to knowledge base…"
                : answerPhase === "saving" || submitting
                ? "Saving answer…"
                : answering?.status === "answered"
                ? "Save changes"
                : answeringGroup && (answeringGroup.ids?.length || 0) > 1
                ? `Send to all ${answeringGroup.ids.length}`
                : "Send answer"}
            </button>
          </>
        }
      >
        {answering && (
          <form id="answer-question-form" onSubmit={doAnswer} className="space-y-3">
            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: C.surfaceAlt }}>
              <p className="text-xs mb-0.5" style={{ color: C.muted }}>
                {answeringGroup
                  ? `Asked ${plural(answeringGroup.count ?? answeringGroup.ids?.length ?? 1, "time")}` +
                    (answeringGroup.askers ? ` by ${plural(answeringGroup.askers, "person", "people")}` : "")
                  : `${askerLabel(answering)} asked`}
              </p>
              <p className="text-sm whitespace-pre-wrap wrap-break-word" style={{ color: C.text }}>
                {answering.question}
              </p>
            </div>
            <div>
              <label className="flex items-baseline justify-between text-xs font-medium mb-1" style={{ color: C.muted }}>
                <span>Your answer</span>
                <span style={{ color: answerText.length > MAX_ANSWER ? C.danger : C.muted }}>
                  {answerText.length}/{MAX_ANSWER}
                </span>
              </label>
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={8}
                maxLength={MAX_ANSWER}
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none"
                style={{ backgroundColor: C.input, borderColor: C.border, color: C.text }}
              />
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: C.text }}>
              <input
                type="checkbox"
                checked={addToKB}
                onChange={(e) => setAddToKB(e.target.checked)}
                className="mt-0.5"
                style={{ accentColor: C.navy }}
              />
              <span>
                Also add to chatbot knowledge base
                <span className="block text-xs" style={{ color: C.muted }}>
                  The chatbot will use this Q&amp;A to answer similar questions in future.
                </span>
              </span>
            </label>
            <p className="text-xs" style={{ color: C.muted }}>
              {answering.status === "answered"
                ? `Editing replaces the saved answer${
                    addToKB ? " and its knowledge-base entry" : ""
                  }; the student is notified again only if the text changed.`
                : answeringGroup
                ? `Every open question in this group gets this answer${
                    answeringGroup.askers ? "; signed-in students are notified in the app and by email" : ""
                  }. The knowledge base gets one entry.`
                : !notifiable(answering)
                ? "This was asked by a guest, so nobody will be notified."
                : "The student will be notified in the app and by email."}
            </p>
          </form>
        )}
      </AdminModal>

      <ConfirmDialog
        open={!!confirmDismiss}
        onClose={() => !submitting && setConfirmDismiss(null)}
        onConfirm={doConfirmDismiss}
        loading={submitting}
        title={
          confirmDismiss?.group && (confirmDismiss.group.ids?.length || 0) > 1
            ? "Dismiss all similar questions?"
            : "Dismiss question?"
        }
        message={
          confirmDismiss?.group && (confirmDismiss.group.ids?.length || 0) > 1
            ? `All ${confirmDismiss.group.ids.length} open questions in this group move to Dismissed. Nobody is notified.`
            : "The question moves to Dismissed. Nobody is notified."
        }
        confirmLabel={
          confirmDismiss?.group && (confirmDismiss.group.ids?.length || 0) > 1 ? "Dismiss all" : "Dismiss"
        }
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={submitting}
        destructive
        title="Delete question?"
        message="This permanently removes the question. Anything already added to the knowledge base stays there."
        confirmLabel="Delete"
      />
    </div>
  );
};

export default Questions;
