import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import moment from "moment";
import {
  Mail,
  ChevronDown,
  ChevronRight,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import {
  fetchEmailSettings,
  saveEmailSettings,
  sendTestEmail,
} from "../../redux/slices/adminSettingsSlice";
import { getPalette } from "../utils/palette";
import { ProgressLine } from "../../components/ProgressSteps";

const EMAIL_RE = /^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$/;
const DEFAULTS = { senderName: "UniAssist — MAJU", smtpHost: "smtp.gmail.com", smtpPort: 587 };

const SOURCE_LABELS = {
  database: "Admin settings",
  env: ".env fallback",
  none: "Not configured",
};

const fromSettings = (s) => ({
  senderEmail: s?.senderEmail || "",
  senderName: s?.senderName || DEFAULTS.senderName,
  smtpHost: s?.smtpHost || DEFAULTS.smtpHost,
  smtpPort: String(s?.smtpPort || DEFAULTS.smtpPort),
  appPassword: "",
});

const Field = ({ label, hint, children, C }) => (
  <label className="block">
    <span className="block text-xs font-medium mb-1" style={{ color: C.muted }}>
      {label}
    </span>
    {children}
    {hint && (
      <span className="block text-xs mt-1" style={{ color: C.muted }}>
        {hint}
      </span>
    )}
  </label>
);

// Admin → Settings: the university's single sending account (OTPs and
// notification emails). Saved settings take priority over EMAIL_USER /
// EMAIL_PASS in server/.env, which stay as a first-boot fallback.
const Settings = () => {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.theme.theme);
  const user = useSelector((s) => s.auth.user);
  const { email: settings, emailLoading, emailError } = useSelector((s) => s.adminSettings);
  const C = getPalette(theme === "dark");

  const [form, setForm] = useState(() => fromSettings(settings));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savingSince, setSavingSince] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  // Untouched forms follow the server copy; once the admin edits, a refetch
  // must not overwrite what they typed.
  const dirtyRef = useRef(false);

  useEffect(() => {
    dispatch(fetchEmailSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings && !dirtyRef.current) setForm(fromSettings(settings));
  }, [settings]);

  const set = (key) => (e) => {
    dirtyRef.current = true;
    setSaveError("");
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const saving = savingSince !== null;
  const hasPassword = !!settings?.hasPassword;
  const source = settings?.source || "none";

  const validate = () => {
    const senderEmail = form.senderEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(senderEmail)) return "Enter a valid sender email address.";
    const port = Number(form.smtpPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return "SMTP port must be a number between 1 and 65535.";
    if (!form.smtpHost.trim()) return "SMTP host is required.";
    if (!hasPassword && !form.appPassword.trim()) return "Enter the app password for this account.";
    return "";
  };

  const save = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setSaveError(problem);
      return;
    }
    const host = form.smtpHost.trim();
    // Google shows app passwords in groups of four ("abcd efgh ..."); the
    // spaces are not part of the password.
    const rawPassword = form.appPassword.trim();
    const appPassword = /gmail\.com$/i.test(host) ? rawPassword.replace(/\s+/g, "") : rawPassword;
    const body = {
      senderEmail: form.senderEmail.trim().toLowerCase(),
      senderName: form.senderName.trim() || DEFAULTS.senderName,
      smtpHost: host,
      smtpPort: Number(form.smtpPort),
    };
    if (appPassword) body.appPassword = appPassword;

    setSaveError("");
    setSavingSince(Date.now());
    const res = await dispatch(saveEmailSettings(body)).unwrap();
    setSavingSince(null);
    if (res.success) {
      dirtyRef.current = false;
      setForm(fromSettings(res.settings));
      setTestResult(null);
      toast.success("Saved — signed in to the mail server");
    } else {
      setSaveError(res.message);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await dispatch(sendTestEmail(user?.email ? { to: user.email } : {})).unwrap();
    setTesting(false);
    setTestResult(res);
    if (res.success) toast.success(res.message || "Test email sent");
    else toast.error(res.message || "Test email failed");
    dispatch(fetchEmailSettings());
  };

  const inputClass = "w-full px-3 py-2 text-sm rounded-lg border focus:outline-none disabled:opacity-60";
  const inputStyle = { backgroundColor: C.input, borderColor: C.border, color: C.text };
  const statusColor = source === "none" ? C.danger : source === "env" ? C.amber : C.green;

  if (!settings && emailLoading) {
    return (
      <div className="max-w-2xl">
        <ProgressLine label="Loading email settings…" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {!settings && emailError && (
        <div
          className="rounded-xl border p-3 text-sm flex items-center justify-between gap-3"
          style={{ borderColor: C.border, backgroundColor: C.surface, color: C.danger }}
          role="alert"
        >
          <span>Couldn&apos;t load email settings: {emailError}</span>
          <button
            type="button"
            onClick={() => dispatch(fetchEmailSettings())}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border"
            style={{ borderColor: C.border, color: C.text }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      )}

      <section className="rounded-xl border" style={{ backgroundColor: C.surface, borderColor: C.border }}>
        <header className="px-4 py-3 border-b" style={{ borderColor: C.border }}>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: C.text }}>
            <Mail className="w-4 h-4" style={{ color: C.navy }} />
            University email
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            Sends registration OTPs, password resets and notification emails.
          </p>
        </header>

        {/* Status */}
        <div className="px-4 py-2.5 border-b text-xs flex flex-wrap items-center gap-x-4 gap-y-1" style={{ borderColor: C.border }}>
          <span className="inline-flex items-center gap-1.5" style={{ color: C.text }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} aria-hidden="true" />
            Source: <strong className="font-medium">{SOURCE_LABELS[source] || source}</strong>
            {settings?.senderEmail && source !== "none" && (
              <span style={{ color: C.muted }}>({settings.senderEmail})</span>
            )}
          </span>
          {settings?.lastTestAt ? (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: settings.lastTestOk ? C.green : C.danger }}
              title={moment(settings.lastTestAt).format("LLL")}
            >
              {settings.lastTestOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              Last check {settings.lastTestOk ? "passed" : "failed"} {moment(settings.lastTestAt).fromNow()}
              {!settings.lastTestOk && settings.lastTestError && (
                <span className="wrap-break-word" style={{ color: C.muted }}>
                  — {settings.lastTestError}
                </span>
              )}
            </span>
          ) : (
            <span style={{ color: C.muted }}>Not tested yet</span>
          )}
        </div>

        <form onSubmit={save} className="p-4 space-y-3" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Sender email" C={C}>
              <input
                type="email"
                value={form.senderEmail}
                onChange={set("senderEmail")}
                disabled={saving}
                autoComplete="off"
                placeholder="uniassist@jinnah.edu"
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <Field label="Sender name" C={C}>
              <input
                type="text"
                value={form.senderName}
                onChange={set("senderName")}
                disabled={saving}
                maxLength={100}
                placeholder={DEFAULTS.senderName}
                className={inputClass}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field
            label="App password"
            C={C}
            hint={hasPassword ? "Leave blank to keep the saved password." : "Required — the account's app password."}
          >
            <input
              type="password"
              value={form.appPassword}
              onChange={set("appPassword")}
              disabled={saving}
              autoComplete="new-password"
              placeholder={hasPassword ? "•••••••• (saved)" : "16-character app password"}
              className={`${inputClass} font-mono`}
              style={inputStyle}
            />
          </Field>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: C.muted }}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Advanced (SMTP server)
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="sm:col-span-2">
                  <Field label="SMTP host" C={C}>
                    <input
                      type="text"
                      value={form.smtpHost}
                      onChange={set("smtpHost")}
                      disabled={saving}
                      placeholder={DEFAULTS.smtpHost}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </Field>
                </div>
                <Field label="Port" C={C} hint="587 (STARTTLS) or 465 (SSL)">
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={form.smtpPort}
                    onChange={set("smtpPort")}
                    disabled={saving}
                    className={inputClass}
                    style={inputStyle}
                  />
                </Field>
              </div>
            )}
          </div>

          {saveError && (
            <p className="text-xs wrap-break-word" style={{ color: C.danger }} role="alert">
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: C.navy }}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Verifying…" : "Save & verify"}
            </button>
            <button
              type="button"
              onClick={test}
              disabled={saving || testing || source === "none"}
              title={source === "none" ? "Save the email settings first" : `Send a test email to ${user?.email || "you"}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border disabled:opacity-50"
              style={{ borderColor: C.border, color: C.text }}
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {testing ? "Sending…" : "Send test email"}
            </button>
            {saving && <ProgressLine label="Signing in to the mail server…" startedAt={savingSince} />}
            {!saving && testResult && (
              <span className="text-xs wrap-break-word" style={{ color: testResult.success ? C.green : C.danger }}>
                {testResult.success
                  ? testResult.message || `Test email sent to ${user?.email || "your address"}`
                  : testResult.message}
              </span>
            )}
          </div>
        </form>

        <div className="px-4 py-3 border-t text-xs space-y-1" style={{ borderColor: C.border, color: C.muted }}>
          <p className="flex items-center gap-1.5 font-medium" style={{ color: C.text }}>
            <KeyRound className="w-3.5 h-3.5" /> Using Gmail / Google Workspace?
          </p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>Turn on 2-Step Verification for the sending account.</li>
            <li>
              Open Google Account → Security → App passwords, create one (e.g. &quot;UniAssist&quot;) and paste the
              16-character code above.
            </li>
            <li>Your normal Gmail password will not work here.</li>
          </ol>
        </div>
      </section>
    </div>
  );
};

export default Settings;
