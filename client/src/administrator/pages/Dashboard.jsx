import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  Shield,
  Building2,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Flag,
  UserX,
  MessageCircleQuestion,
  AlarmClock,
  MailWarning,
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
import { fetchAdminStats } from "../../redux/slices/adminStatsSlice";
import { fetchEmailSettings } from "../../redux/slices/adminSettingsSlice";
import StatCard from "../components/StatCard";
import { C, useChartColors } from "../../theme/palette";

const POLL_MS = 20000;

const Dashboard = () => {
  const dispatch = useDispatch();
  const { stats, loading } = useSelector((s) => s.adminStats);
  const emailSource = useSelector((s) => s.adminSettings.email?.source);
  const cc = useChartColors("border", "text-muted");

  useEffect(() => {
    dispatch(fetchEmailSettings());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchAdminStats());
    const id = setInterval(() => {
      if (document.visibilityState === "visible") dispatch(fetchAdminStats());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [dispatch]);

  const u = stats?.users || {};
  const i = stats?.issues || { byStatus: {}, last7d: [] };
  const d = stats?.departments || {};
  const ch = stats?.chats || {};
  const open = (i.byStatus?.Pending || 0) + (i.byStatus?.["In Progress"] || 0);
  const resolved = (i.byStatus?.Resolved || 0) + (i.byStatus?.Closed || 0);
  // Open issues that got no staff response within their department's SLA.
  const escalatedOpen = stats?.escalatedOpen ?? i.escalatedOpen ?? 0;

  return (
    <div className="space-y-6">
      {emailSource === "none" && (
        <Link
          to="/admin/settings"
          role="alert"
          className="flex items-center gap-2 rounded-control border px-4 py-2.5 text-sm"
          style={{ borderColor: C.dangerBorder, backgroundColor: C.dangerBg, color: C.text }}
        >
          <MailWarning className="w-4 h-4 shrink-0" style={{ color: C.danger }} />
          <span className="flex-1">
            <strong className="font-semibold">Email is not configured — students can&apos;t register.</strong>{" "}
            <span style={{ color: C.muted }}>OTPs and notification emails can&apos;t be sent.</span>
          </span>
          <span className="font-semibold whitespace-nowrap" style={{ color: C.link }}>
            Set it up →
          </span>
        </Link>
      )}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Link to="/admin/questions" className="block rounded-card focus-ring" title="Review unanswered questions">
          <StatCard
            icon={MessageCircleQuestion}
            label="Open Questions"
            value={stats?.openQuestions ?? 0}
            hint="Unanswered by the chatbot"
            accent={C.warning}
            loading={loading && !stats}
          />
        </Link>
        <StatCard icon={GraduationCap} label="Students" value={u.students ?? 0} accent={C.primary} loading={loading && !stats} />
        <StatCard icon={Users} label="Staff" value={u.staff ?? 0} accent={C.accentStrong} loading={loading && !stats} />
        <StatCard icon={Shield} label="Admins" value={u.admins ?? 0} accent={C.primary} loading={loading && !stats} />
        <StatCard icon={Building2} label="Departments" value={`${d.active ?? 0} / ${d.total ?? 0}`} hint="active / total" accent={C.accentStrong} loading={loading && !stats} />
        <StatCard icon={AlertCircle} label="Open Issues" value={open} accent={C.warning} loading={loading && !stats} />
        <Link to="/admin/query?escalated=true" className="block rounded-card focus-ring" title="Review escalated issues">
          <StatCard
            icon={AlarmClock}
            label="Escalated"
            value={escalatedOpen}
            hint="Open past their SLA"
            accent={escalatedOpen > 0 ? C.danger : C.success}
            loading={loading && !stats}
          />
        </Link>
        <StatCard icon={CheckCircle2} label="Resolved Issues" value={resolved} accent={C.success} loading={loading && !stats} />
        <StatCard icon={MessageSquare} label="Total Chats" value={ch.total ?? 0} accent={C.primary} loading={loading && !stats} />
        <StatCard icon={Flag} label="Flagged Students" value={u.flagged ?? 0} hint={u.blocked ? `${u.blocked} blocked` : null} accent={C.danger} loading={loading && !stats} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="lg:col-span-2 rounded-card border p-4"
          style={{ backgroundColor: C.surface, borderColor: C.border, boxShadow: C.shadowSm }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold" style={{ color: C.heading }}>
              Issues — last 7 days
            </h3>
            <span className="text-xs" style={{ color: C.muted }}>
              Total this week: {i.last7d?.reduce((a, b) => a + b.count, 0) ?? 0}
            </span>
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={i.last7d || []} margin={{ top: 6, right: 12, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="issueArea" x1="0" y1="0" x2="0" y2="1">
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
                  contentStyle={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, boxShadow: C.shadowLg }}
                  labelFormatter={(v) => moment(v).format("ddd, MMM D")}
                />
                <Area type="monotone" dataKey="count" stroke={cc.series[0]} fill="url(#issueArea)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="rounded-card border p-4"
          style={{ backgroundColor: C.surface, borderColor: C.border, boxShadow: C.shadowSm }}
        >
          <h3 className="text-base font-bold mb-3" style={{ color: C.heading }}>
            Recent student signups
          </h3>
          <ul className="space-y-2">
            {(stats?.recentSignups || []).map((s) => (
              <li key={s._id} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: C.primary, color: C.onPrimary }}
                >
                  {s.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: C.text }}>
                    {s.name}
                    {s.isBlocked && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs" style={{ color: C.danger }}>
                        <UserX className="w-3 h-3" /> blocked
                      </span>
                    )}
                  </p>
                  <p className="text-xs truncate" style={{ color: C.muted }}>
                    {s.email} · {moment(s.createdAt).fromNow()}
                  </p>
                </div>
              </li>
            ))}
            {(!stats?.recentSignups || stats.recentSignups.length === 0) && (
              <li className="text-sm" style={{ color: C.muted }}>
                No signups yet.
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {["Pending", "In Progress", "Resolved", "Closed"].map((k) => (
          <div
            key={k}
            className="rounded-card border px-4 py-3"
            style={{ backgroundColor: C.surface, borderColor: C.border, boxShadow: C.shadowSm }}
          >
            <p className="text-xs uppercase tracking-wide" style={{ color: C.muted }}>
              {k}
            </p>
            <p className="text-lg font-extrabold" style={{ color: C.heading }}>
              {i.byStatus?.[k] ?? 0}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Dashboard;
