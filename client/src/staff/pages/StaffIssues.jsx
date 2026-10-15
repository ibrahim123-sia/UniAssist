import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { FileText, Clock, RefreshCw, Building2 } from "lucide-react";
import moment from "moment";
import { fetchDeptIssues } from "../../redux/slices/issueSlice";
import OverdueBadge from "../../components/OverdueBadge";
import { isOverdue, statusStyle } from "../../utils/issues";

const STATUSES = ["All", "Pending", "In Progress", "Resolved", "Closed", "Rejected"];

const StaffIssues = () => {
  const dispatch = useDispatch();
  const issues = useSelector((s) => s.issue.deptIssues);
  const loading = useSelector((s) => s.issue.loading);
  const user = useSelector((s) => s.auth.user);
  const [filter, setFilter] = useState("All");
  useEffect(() => {
    dispatch(fetchDeptIssues(filter === "All" ? undefined : filter));
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        dispatch(fetchDeptIssues(filter === "All" ? undefined : filter));
      }
    }, 20000);
    return () => clearInterval(id);
  }, [dispatch, filter]);

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = s === "All" ? issues.length : issues.filter((i) => i.status === s).length;
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto bg-bg text-text">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-heading">Department Inbox</h1>
            <p className="text-sm mt-1 inline-flex items-center gap-1.5 text-muted">
              <Building2 className="w-4 h-4" />
              {user?.staffTitle || "Staff"} · viewing only your department's issues
            </p>
          </div>
          <button
            onClick={() => dispatch(fetchDeptIssues(filter === "All" ? undefined : filter))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors focus-ring ${
                filter === s
                  ? "bg-primary border-primary text-on-primary"
                  : "bg-surface dark:bg-transparent border-border-strong text-pill hover:bg-nav-hover"
              }`}
            >
              {s} {counts[s] !== undefined && <span className="opacity-75">({counts[s]})</span>}
            </button>
          ))}
        </div>

        {loading && issues.length === 0 ? (
          <div className="text-center py-12 text-muted">Loading…</div>
        ) : issues.length === 0 ? (
          <div
            className="text-center py-16 border border-border bg-surface rounded-card shadow-card"
          >
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted" />
            <p className="text-base font-bold text-heading">No issues</p>
            <p className="text-sm mt-1 text-muted">
              No {filter === "All" ? "" : filter.toLowerCase()} issues for your department right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => {
              const sStyle = statusStyle(issue.status);
              return (
                <Link
                  key={issue._id}
                  to={`/staff/issues/${issue._id}`}
                  className={`block p-4 rounded-card border bg-surface shadow-card transition-colors hover:bg-row-hover focus-ring ${
                    isOverdue(issue) ? "border-danger-border" : "border-border hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold truncate text-heading">{issue.title}</h3>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full uppercase font-bold border"
                          style={{ backgroundColor: sStyle.bg, color: sStyle.text, borderColor: sStyle.border }}
                        >
                          {issue.status}
                        </span>
                        <OverdueBadge issue={issue} />
                      </div>
                      <p className="text-sm line-clamp-2 text-muted">
                        {issue.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs flex-wrap text-muted">
                        <span>From: {issue.studentName}</span>
                        <span>{issue.studentEmail}</span>
                        <span>Category: {issue.category}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {moment(issue.updatedAt).fromNow()}
                        </span>
                        {issue.replies?.length > 0 && (
                          <span>{issue.replies.length} repl{issue.replies.length === 1 ? "y" : "ies"}</span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                            issue.assignedTo
                              ? issue.assignedTo._id === user?._id
                                ? "bg-info-bg text-info border-info-border font-semibold"
                                : "bg-surface-muted text-muted border-transparent"
                              : "bg-transparent text-muted border-dashed border-border-strong"
                          }`}
                        >
                          {issue.assignedTo
                            ? (issue.assignedTo._id === user?._id
                                ? "Assigned to you"
                                : `Assigned: ${issue.assignedTo.name}`)
                            : "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffIssues;
