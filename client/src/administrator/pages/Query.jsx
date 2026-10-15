import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Search,
  HelpCircle,
  Clock,
  TrendingUp,
  Layers,
  X,
  AlarmClock,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import moment from "moment";
import {
  fetchAdminIssues,
  fetchAnalytics,
  fetchAdminIssueById,
  clearSelected,
} from "../../redux/slices/adminQuerySlice";
import { fetchDepartments } from "../../redux/slices/departmentSlice";
import AdminTable, { AdminTableRow, AdminTableCell } from "../components/AdminTable";
import LoadingSkeleton from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import StatCard from "../components/StatCard";
import { C, useChartColors } from "../../theme/palette";
import { useDebouncedSearch } from "../utils/useDebouncedSearch";
import OverdueBadge from "../../components/OverdueBadge";
import StarRating from "../../components/StarRating";

const PAGE_SIZE = 25;
const STATUSES = ["Pending", "In Progress", "Resolved", "Closed"];

// Status badge colors: { color, bg } from the status tokens.
const statusTone = (status) => {
  if (status === "Pending") return { color: C.warning, backgroundColor: C.warningBg };
  if (status === "In Progress") return { color: C.info, backgroundColor: C.infoBg };
  if (status === "Resolved") return { color: C.success, backgroundColor: C.successBg };
  return { color: C.muted, backgroundColor: C.surfaceMuted };
};

const Query = () => {
  const dispatch = useDispatch();
  const cc = useChartColors("border", "text-muted", "row-hover");
  const departments = useSelector((s) => s.department.departments);
  const { issues, total, analytics, selected, loading, detailLoading } = useSelector(
    (s) => s.adminQuery
  );

  const navigate = useNavigate();
  const { id: routeIssueId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // Escalation alerts link here as /admin/query?issue=<id> (or /admin/query/<id>);
  // the dashboard's Escalated card as ?escalated=true.
  const linkedIssueId = searchParams.get("issue") || routeIssueId;

  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [escalatedOnly, setEscalatedOnly] = useState(() => searchParams.get("escalated") === "true");
  const [page, setPage] = useState(1);
  const {
    input: searchInput,
    setInput: setSearchInput,
    search,
  } = useDebouncedSearch(() => setPage(1));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const listQuery = useMemo(
    () => ({
      departmentId: deptFilter || undefined,
      status: statusFilter || undefined,
      escalated: escalatedOnly || undefined,
      search,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [deptFilter, statusFilter, escalatedOnly, search, page]
  );

  useEffect(() => {
    dispatch(fetchAdminIssues(listQuery));
  }, [dispatch, listQuery]);

  useEffect(() => {
    dispatch(fetchAnalytics());
    if (!departments?.length) dispatch(fetchDepartments());
  }, [dispatch, departments?.length]);


  const openDetail = (id) => {
    setDrawerOpen(true);
    dispatch(fetchAdminIssueById(id));
  };
  const closeDetail = () => {
    setDrawerOpen(false);
    dispatch(clearSelected());
    // Drop the deep link so closing the drawer doesn't reopen it.
    if (routeIssueId) {
      navigate("/admin/query", { replace: true });
    } else if (searchParams.get("issue")) {
      const next = new URLSearchParams(searchParams);
      next.delete("issue");
      setSearchParams(next, { replace: true });
    }
  };

  useEffect(() => {
    if (!linkedIssueId) return;
    setDrawerOpen(true);
    dispatch(fetchAdminIssueById(linkedIssueId));
  }, [dispatch, linkedIssueId]);

  const topCategory = analytics?.byCategory?.[0];
  const totalIssues = (analytics?.byStatus &&
    Object.values(analytics.byStatus).reduce((a, b) => a + b, 0)) || 0;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={HelpCircle} label="Total queries" value={totalIssues} accent={C.primary} />
        <StatCard
          icon={TrendingUp}
          label="Most asked"
          value={topCategory ? topCategory.category : "—"}
          hint={topCategory ? `${topCategory.count} times` : ""}
          accent={C.accentStrong}
        />
        <StatCard
          icon={Clock}
          label="Avg resolution"
          value={analytics?.avgResolutionHours != null ? `${analytics.avgResolutionHours}h` : "—"}
          hint={analytics?.resolvedCount ? `${analytics.resolvedCount} resolved` : ""}
          accent={C.success}
        />
        <StatCard
          icon={Layers}
          label="Departments handling"
          value={analytics?.byDepartment?.length || 0}
          accent={C.warning}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-card border p-4 bg-surface border-border shadow-card">
          <h3 className="text-sm font-semibold mb-3" style={{ color: C.heading }}>
            Top categories
          </h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={analytics?.byCategory || []} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                <XAxis dataKey="category" tick={{ fill: cc["text-muted"], fontSize: 11 }} stroke={cc.border} />
                <YAxis tick={{ fill: cc["text-muted"], fontSize: 11 }} stroke={cc.border} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text }} cursor={{ fill: cc["row-hover"] }} />
                <Bar dataKey="count" fill={cc.series[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-card border p-4 bg-surface border-border shadow-card">
          <h3 className="text-sm font-semibold mb-3" style={{ color: C.heading }}>
            By department
          </h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={analytics?.byDepartment || []} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                <XAxis dataKey="code" tick={{ fill: cc["text-muted"], fontSize: 11 }} stroke={cc.border} />
                <YAxis tick={{ fill: cc["text-muted"], fontSize: 11 }} stroke={cc.border} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text }} cursor={{ fill: cc["row-hover"] }} />
                <Bar dataKey="count" fill={cc.series[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, description, student..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>{d.code} — {d.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setEscalatedOnly((v) => !v);
            setPage(1);
          }}
          aria-pressed={escalatedOnly}
          className="px-3 py-2.5 text-sm rounded-control border flex items-center gap-1.5 transition-colors focus-ring"
          style={{
            backgroundColor: escalatedOnly ? C.warningBg : C.surface,
            borderColor: escalatedOnly ? C.warningBorder : C.borderStrong,
            color: escalatedOnly ? C.warning : C.label,
          }}
          title="Issues that got no staff response within their department's SLA"
        >
          <AlarmClock className="w-4 h-4" />
          Escalated
        </button>
      </section>

      <AdminTable
        columns={[
          { key: "title", label: "Title" },
          { key: "student", label: "Student" },
          { key: "department", label: "Department" },
          { key: "category", label: "Category" },
          { key: "status", label: "Status" },
          { key: "created", label: "Created" },
        ]}
      >
        {loading ? (
          <LoadingSkeleton cols={6} />
        ) : issues.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={6}>
                <EmptyState
                  icon={HelpCircle}
                  title={escalatedOnly ? "No escalated issues" : "No queries found"}
                  description={
                    escalatedOnly
                      ? "Every issue got a staff response within its department's SLA."
                      : "Adjust filters or wait for students to submit issues."
                  }
                />
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {issues.map((iss) => (
              <AdminTableRow key={iss._id} onClick={() => openDetail(iss._id)}>
                <AdminTableCell>
                  <span className="font-medium" style={{ color: C.text }}>{iss.title}</span>
                  {iss.source === "chatbot" && (
                    <span className="ml-1.5 text-xs" style={{ color: C.muted }}>· from chat</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <div className="text-sm" style={{ color: C.muted }}>
                    <div style={{ color: C.text }}>{iss.studentName}</div>
                    <div className="text-xs">{iss.studentEmail}</div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: C.muted }}>{iss.department?.code || "—"}</span>
                </AdminTableCell>
                <AdminTableCell>
                  <span
                    className="px-2 py-0.5 text-xs rounded-full font-medium"
                    style={{ backgroundColor: C.surfaceMuted, color: C.text }}
                  >
                    {iss.category || "other"}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap"
                      style={statusTone(iss.status)}
                    >
                      {iss.status}
                    </span>
                    <OverdueBadge issue={iss} />
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <span style={{ color: C.muted }}>{moment(iss.createdAt).fromNow()}</span>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </tbody>
        )}
      </AdminTable>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={closeDetail}>
          <div className="flex-1" style={{ backgroundColor: C.overlay }} />
          <aside
            className="w-full sm:w-[520px] h-full overflow-y-auto border-l"
            style={{ backgroundColor: C.surface, borderColor: C.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              className="px-5 py-4 border-b flex items-center justify-between sticky top-0 z-10"
              style={{ borderColor: C.border, backgroundColor: C.surface }}
            >
              <h2 className="text-base font-semibold" style={{ color: C.heading }}>Issue detail</h2>
              <button onClick={closeDetail} className="p-1 rounded" style={{ color: C.muted }}>
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="p-5 space-y-4">
              {detailLoading && <p className="text-sm" style={{ color: C.muted }}>Loading...</p>}
              {selected && (
                <>
                  <div>
                    <h3 className="text-lg font-bold mb-1" style={{ color: C.heading }}>{selected.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: C.surfaceMuted, color: C.text }}>
                        {selected.category}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full font-medium"
                        style={statusTone(selected.status)}
                      >
                        {selected.status}
                      </span>
                      <OverdueBadge issue={selected} />
                      <span style={{ color: C.muted }}>{selected.department?.code}</span>
                    </div>
                    {selected.escalated && selected.escalatedAt && (
                      <p className="text-xs mt-1.5" style={{ color: C.muted }}>
                        Escalated {moment(selected.escalatedAt).format("MMM D, YYYY h:mm A")}
                        {selected.firstStaffResponseAt &&
                          ` · first staff response ${moment(selected.firstStaffResponseAt).format("MMM D, h:mm A")}`}
                      </p>
                    )}
                  </div>
                  <div className="text-sm rounded-control p-3 border whitespace-pre-wrap" style={{ borderColor: C.border, backgroundColor: C.surfaceMuted, color: C.text }}>
                    {selected.description}
                  </div>
                  {selected.feedback?.rating && (
                    <div className="text-sm">
                      <p className="font-semibold mb-1" style={{ color: C.text }}>Student feedback</p>
                      <div className="flex items-center gap-2">
                        <StarRating value={selected.feedback.rating} size={16} emptyColor={C.muted} />
                        <span style={{ color: C.muted }}>{selected.feedback.rating}/5</span>
                      </div>
                      {selected.feedback.comment && (
                        <p className="mt-1 whitespace-pre-wrap" style={{ color: C.muted }}>{selected.feedback.comment}</p>
                      )}
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="font-semibold mb-1" style={{ color: C.text }}>Student</p>
                    <p style={{ color: C.muted }}>{selected.studentName} · {selected.studentEmail}</p>
                  </div>
                  {selected.assignedTo && (
                    <div className="text-sm">
                      <p className="font-semibold mb-1" style={{ color: C.text }}>Assigned staff</p>
                      <p style={{ color: C.muted }}>
                        {selected.assignedTo.name} ({selected.assignedTo.staffTitle || "staff"})
                      </p>
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
                      Conversation ({selected.replies?.length || 0})
                    </h4>
                    <ul className="space-y-2">
                      {(selected.replies || []).map((r) => (
                        <li
                          key={r._id}
                          className="text-sm p-3 rounded-control border"
                          style={{
                            borderColor: r.authorRole === "staff" ? C.infoBorder : C.border,
                            backgroundColor: r.authorRole === "staff" ? C.infoBg : C.surfaceMuted,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-xs" style={{ color: C.text }}>
                              {r.authorName} <span style={{ color: C.muted }}>· {r.authorRole}</span>
                            </span>
                            <span className="text-xs" style={{ color: C.muted }}>
                              {moment(r.createdAt).fromNow()}
                            </span>
                          </div>
                          <p style={{ color: C.text }}>{r.message}</p>
                        </li>
                      ))}
                      {(!selected.replies || selected.replies.length === 0) && (
                        <li className="text-sm" style={{ color: C.muted }}>No replies yet.</li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Query;
