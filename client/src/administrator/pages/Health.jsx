import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Server,
  Database,
  Cpu,
  Sparkles,
  BookOpen,
  Mail,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import moment from "moment";
import { fetchSystemHealth } from "../../redux/slices/adminHealthSlice";
import { C } from "../../theme/palette";
import { ProgressLine } from "../../components/ProgressSteps";

const PROVIDER_LABELS = { groq: "Groq", gemini: "Gemini", ollama: "Ollama (local)" };

// "groq#2" → "Groq #2"
const providerLabel = (name = "") => {
  const [base, n] = name.split("#");
  return `${PROVIDER_LABELS[base] || base}${n ? ` #${n}` : ""}`;
};

const formatUptime = (sec) => {
  if (sec == null) return null;
  const d = moment.duration(sec, "seconds");
  if (d.asDays() >= 1) return `${Math.floor(d.asDays())}d ${d.hours()}h`;
  if (d.asHours() >= 1) return `${Math.floor(d.asHours())}h ${d.minutes()}m`;
  return `${Math.max(0, Math.floor(d.asMinutes()))}m`;
};

const latency = (ms) => (ms == null ? null : `${Math.round(ms)} ms`);

// ok → success, warn → warning, down → danger, off → muted (not configured),
// unknown → warning, checking → muted while the first check is in flight.
const TONE_LABELS = {
  ok: "Healthy",
  warn: "Degraded",
  down: "Down",
  off: "Not configured",
  unknown: "Unknown",
  checking: "Checking…",
};

// { color, bg, border } status tokens for a tone.
const toneStyle = (tone, C) => {
  const muted = { color: C.muted, bg: C.surfaceMuted, border: C.border };
  return (
    {
      ok: { color: C.success, bg: C.successBg, border: C.successBorder },
      warn: { color: C.warning, bg: C.warningBg, border: C.warningBorder },
      down: { color: C.danger, bg: C.dangerBg, border: C.dangerBorder },
      unknown: { color: C.warning, bg: C.warningBg, border: C.warningBorder },
      off: muted,
      checking: muted,
    }[tone] || muted
  );
};

const EMAIL_SOURCES = { database: "Admin settings", env: ".env fallback", none: "Not configured" };

const toneOf = (ok) => (ok === true ? "ok" : ok === false ? "down" : "unknown");

const HealthCard = ({ icon, title, tone, label, lines = [], error, footer, C }) => {
  const Icon = icon;
  const { color, bg, border } = toneStyle(tone, C);
  return (
    <div
      className="rounded-card border p-4 flex flex-col gap-2"
      style={{ backgroundColor: C.surface, borderColor: tone === "down" ? border : C.border, boxShadow: C.shadowSm }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-control flex items-center justify-center shrink-0"
            style={{ backgroundColor: bg, color }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold truncate" style={{ color: C.heading }}>
            {title}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap"
          style={{ backgroundColor: bg, borderColor: border, color }}
        >
          {tone === "checking" ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          )}
          {label || TONE_LABELS[tone]}
        </span>
      </div>
      {lines.filter(Boolean).length > 0 && (
        <dl className="text-xs space-y-0.5">
          {lines.filter(Boolean).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt style={{ color: C.muted }}>{k}</dt>
              <dd className="text-right truncate tabular-nums" style={{ color: C.text }} title={String(v)}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {error && (
        <p className="text-xs wrap-break-word" style={{ color: C.danger }}>
          {error}
        </p>
      )}
      {footer}
    </div>
  );
};

const Health = () => {
  const dispatch = useDispatch();
  const { health, loading, error } = useSelector((s) => s.adminHealth);
  // When the current check started — the Refresh button shows elapsed time
  // (provider checks can take up to ~5 s each).
  const [checkStartedAt, setCheckStartedAt] = useState(null);

  const runCheck = useCallback(() => {
    setCheckStartedAt(Date.now());
    dispatch(fetchSystemHealth());
  }, [dispatch]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // Before the first report every card says "Checking…".
  const checking = !health && loading;

  const node = health?.node;
  const mongo = health?.mongo;
  const python = health?.python;
  const email = health?.email;
  const details = python?.details || null;
  const llm = details?.llm;
  const providers = llm?.providers || [];
  const kb = details?.knowledgeBase;

  // Embeddings / speech-to-text models load lazily on first use, so "not
  // loaded yet" is normal and doesn't degrade the AI service's status.
  const pythonTone = checking ? "checking" : !python ? "unknown" : toneOf(python.ok);

  const providerTone = (p) => (!p.configured ? "off" : toneOf(p.ok));
  const anyProviderOk = providers.some((p) => p.configured && p.ok === true);
  const configuredCount = providers.filter((p) => p.configured).length;

  const loaded = (v) => (v === true ? "Loaded" : v === false ? "Loads on first use" : "—");
  const emailSource = email?.source;
  const emailTone = checking
    ? "checking"
    : !email
    ? "unknown"
    : emailSource === "none"
    ? "off"
    : toneOf(email.ok);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm" style={{ color: C.muted }}>
          {health?.checkedAt
            ? `Checked ${moment(health.checkedAt).format("MMM D, h:mm:ss A")} (${moment(health.checkedAt).fromNow()})`
            : loading
            ? "Checking…"
            : "Not checked yet"}
        </p>
        {loading && (
          <ProgressLine label="Checking all services…" startedAt={checkStartedAt} className="ml-auto" />
        )}
        <button
          onClick={runCheck}
          disabled={loading}
          className={`${loading ? "" : "ml-auto "}px-3 py-2 text-sm font-semibold rounded-control border flex items-center gap-2 transition-colors hover:bg-nav-hover! focus-ring disabled:opacity-60`}
          style={{ borderColor: C.borderStrong, color: C.label, backgroundColor: C.surface }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <p
          className="text-sm px-3 py-2 rounded-control border flex items-start gap-2"
          role="alert"
          style={{ borderColor: C.dangerBorder, backgroundColor: C.dangerBg, color: C.text }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.danger }} />
          {error}
          {health && <span style={{ color: C.muted }}> — showing the last successful check.</span>}
        </p>
      )}

      {health || checking ? (
        <>
          <section
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity"
            style={{ opacity: loading && health ? 0.7 : 1 }}
          >
            <HealthCard
              icon={Server}
              title="Server"
              tone={checking ? "checking" : toneOf(node?.ok)}
              lines={[
                node?.uptimeSec != null && ["Uptime", formatUptime(node.uptimeSec)],
                node?.version && ["Node", node.version],
              ]}
              C={C}
            />
            <HealthCard
              icon={Database}
              title="Database"
              tone={checking ? "checking" : toneOf(mongo?.ok)}
              lines={[mongo?.latencyMs != null && ["Ping", latency(mongo.latencyMs)]]}
              error={mongo?.error}
              C={C}
            />
            <HealthCard
              icon={Cpu}
              title="AI service"
              tone={pythonTone}
              lines={[
                python?.latencyMs != null && ["Response", latency(python.latencyMs)],
                details && ["Embeddings model", loaded(details.embeddings?.loaded)],
                details && ["Speech-to-text", loaded(details.whisper?.loaded)],
              ]}
              error={python?.error}
              C={C}
            />
            <HealthCard
              icon={BookOpen}
              title="Knowledge base"
              tone={checking ? "checking" : !kb ? "unknown" : kb.ok === false ? "down" : kb.chunks === 0 ? "warn" : "ok"}
              label={kb?.ok && kb.chunks === 0 ? "Empty" : undefined}
              lines={[kb && ["Chunks", kb.chunks == null ? "—" : kb.chunks.toLocaleString()]]}
              error={kb?.error || (!kb && python?.ok === false ? "AI service unreachable" : null)}
              C={C}
            />
            <HealthCard
              icon={Mail}
              title="Email"
              tone={emailTone}
              lines={[
                email?.senderEmail && ["Sender", email.senderEmail],
                emailSource && ["Configured in", EMAIL_SOURCES[emailSource] || emailSource],
              ]}
              error={emailSource === "none" ? null : email?.error}
              footer={
                email && (emailSource === "none" || email.ok === false) ? (
                  <Link to="/admin/settings" className="text-xs font-semibold hover:underline" style={{ color: C.link }}>
                    {emailSource === "none" ? "Set up the university email →" : "Check email settings →"}
                  </Link>
                ) : null
              }
              C={C}
            />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-base font-bold" style={{ color: C.heading }}>
                Language models
              </h3>
              {llm?.mode && (
                <span className="text-xs" style={{ color: C.muted }}>
                  {llm.mode === "local" ? "Local mode (Ollama)" : "Cloud mode"} · {configuredCount} configured
                  {configuredCount > 0 && !anyProviderOk && " · none reachable — the chatbot can't answer"}
                </span>
              )}
            </div>
            {checking ? (
              <p
                className="text-sm px-3 py-2 rounded-control border"
                style={{ borderColor: C.border, backgroundColor: C.surface, color: C.muted }}
              >
                Checking language model providers…
              </p>
            ) : providers.length === 0 ? (
              <p
                className="text-sm px-3 py-2 rounded-control border"
                style={{ borderColor: C.border, backgroundColor: C.surface, color: C.muted }}
              >
                {python?.ok === false
                  ? "Provider status is unavailable while the AI service is down."
                  : "No provider details were reported."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map((p) => (
                  <HealthCard
                    key={p.name}
                    icon={Sparkles}
                    title={providerLabel(p.name)}
                    tone={providerTone(p)}
                    lines={[
                      p.model && ["Model", p.model],
                      p.latencyMs != null && ["Response", latency(p.latencyMs)],
                    ]}
                    error={p.configured ? p.error : null}
                    C={C}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};

export default Health;
