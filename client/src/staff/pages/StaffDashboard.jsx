import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  MessageCircle,
  TrendingUp,
  Building2,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import moment from "moment";
import { fetchDeptStats } from "../../redux/slices/issueSlice";
import { statusStyle } from "../../utils/issues";
import { C, useChartColors } from "../../theme/palette";

const POLL_MS = 20000;

const StaffDashboard = () => {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { deptStats, deptStatsLoading } = useSelector((s) => s.issue);
  const cc = useChartColors("border", "text-muted");

  useEffect(() => {
    dispatch(fetchDeptStats());
    const id = setInterval(() => {
      if (document.visibilityState === "visible") dispatch(fetchDeptStats());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [dispatch]);

  const s = deptStats || {};
  const byStatus = s.byStatus || {};
  const open = (byStatus.Pending || 0) + (byStatus["In Progress"] || 0);

  const Card = ({ icon: Icon, label, value, hint, accent }) => (
    <div
      className="border p-4 flex flex-col gap-2 bg-surface border-border rounded-card shadow-card"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </span>
        {Icon && (
          <div
            className={`w-9 h-9 rounded-control flex items-center justify-center ${accent || "bg-info-bg text-info"}`}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-2xl font-extrabold text-heading">
        {deptStatsLoading && !deptStats ? (
          <span
            className="inline-block w-14 h-6 rounded animate-pulse bg-surface-muted"
          />
        ) : (
          value
        )}
      </div>
      {hint && (
        <p className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-bg text-text">
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-heading">Welcome back, {user?.name?.split(" ")[0] || "staff"}</h1>
            <p
              className="text-sm mt-1 inline-flex items-center gap-1.5 text-muted"
            >
              <Building2 className="w-4 h-4" />
              {user?.staffTitle || "Staff"} · viewing your department's overview
            </p>
          </div>
          <Link
            to="/staff/issues"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-control font-bold bg-primary text-on-primary hover:bg-primary-hover focus-ring transition-colors"
          >
            Go to inbox <ArrowRight className="w-4 h-4" />
          </Link>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={AlertCircle} label="Open issues" value={open} hint="Pending + In Progress" accent="bg-warning-bg text-warning" />
          <Card icon={Clock} label="In Progress" value={byStatus["In Progress"] || 0} accent="bg-info-bg text-info" />
          <Card
            icon={CheckCircle2}
            label="Resolved this week"
            value={s.resolvedThisWeek ?? 0}
            accent="bg-success-bg text-success"
          />
          <Card
            icon={TrendingUp}
            label="Avg response"
            value={s.avgResponseHours != null ? `${s.avgResponseHours}h` : "—"}
            hint="time to first staff reply"
            accent="bg-primary-50 text-primary dark:bg-nav-active-bg dark:text-nav-active-text"
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            className="lg:col-span-2 border p-4 bg-surface border-border rounded-card shadow-card"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-heading">
                New issues — last 7 days
              </h3>
              <span className="text-xs text-muted">
                Total this week: {s.last7d?.reduce((a, b) => a + b.count, 0) ?? 0}
              </span>
            </div>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <AreaChart
                  data={s.last7d || []}
                  margin={{ top: 6, right: 12, bottom: 0, left: -10 }}
                >
                  <defs>
                    <linearGradient id="staffArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cc.series[0]} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={cc.series[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.border} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: cc["text-muted"], fontSize: 11 }}
                    tickFormatter={(v) => moment(v).format("MMM D")}
                    stroke={cc.border}
                  />
                  <YAxis tick={{ fill: cc["text-muted"], fontSize: 11 }} stroke={cc.border} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 12,
                      boxShadow: C.shadowLg,
                      color: C.text,
                    }}
                    labelFormatter={(v) => moment(v).format("ddd, MMM D")}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={cc.series[0]}
                    fill="url(#staffArea)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border p-4 bg-surface border-border rounded-card shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-heading">Your activity</h3>
            </div>
            <div className="space-y-3">
              <div
                className="flex items-center gap-3 p-3 rounded-control bg-surface-muted"
              >
                <MessageCircle className="w-5 h-5 shrink-0 text-primary dark:text-link" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {s.repliesGivenByMe ?? 0} replies
                  </p>
                  <p className="text-xs text-muted">
                    posted by you on this dept's issues
                  </p>
                </div>
              </div>

              {["Pending", "In Progress", "Resolved", "Closed", "Rejected"].map((k) => {
                const sb = statusStyle(k);
                return (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs uppercase font-bold border"
                      style={{ backgroundColor: sb.bg, color: sb.text, borderColor: sb.border }}
                    >
                      {k}
                    </span>
                    <span className="text-text">{byStatus[k] ?? 0}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="border p-4 bg-surface border-border rounded-card shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-heading">
              Recent issues
            </h3>
            <Link to="/staff/issues" className="text-xs font-semibold text-link hover:text-link-hover focus-ring rounded">
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {(s.recent || []).map((iss) => {
              const sb = statusStyle(iss.status);
              return (
                <li key={iss._id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    to={`/staff/issues/${iss._id}`}
                    className="flex items-center justify-between gap-3 rounded-control focus-ring"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-heading">
                        {iss.title}
                      </p>
                      <p className="text-xs text-muted">
                        {iss.studentName} · {iss.category} · {moment(iss.updatedAt).fromNow()}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full uppercase font-bold border shrink-0"
                      style={{ backgroundColor: sb.bg, color: sb.text, borderColor: sb.border }}
                    >
                      {iss.status}
                    </span>
                  </Link>
                </li>
              );
            })}
            {(!s.recent || s.recent.length === 0) && (
              <li className="py-3 text-sm text-muted">
                No issues yet. Once students submit issues to your department they'll appear here.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default StaffDashboard;
