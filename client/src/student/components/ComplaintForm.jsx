import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { CheckCircle2, Info, Loader2, Sparkles } from 'lucide-react';
import { fetchDepartmentSuggestion, createIssueFromChat } from '../../redux/slices/issueSlice';
import { fetchDepartments } from '../../redux/slices/departmentSlice';

const MAX_DETAILS = 2000;

const deptLabel = (d) => (d ? d.code || d.name || 'the department' : 'the department');

// Outcome of a filed complaint, shown in place of the form:
// { issue, department, duplicate?, message? }.
export const ComplaintResult = ({ result, isDark }) => {
  const issueId = result.issue?._id;
  const ok = !result.duplicate;
  return (
    <div
      className="flex items-start gap-1.5 text-xs mt-2 px-2 py-1.5 rounded-lg"
      style={{
        backgroundColor: ok
          ? isDark ? 'rgba(111,181,138,0.12)' : '#E0F8E5'
          : isDark ? 'rgba(196,138,74,0.12)' : '#FFF4E0',
        color: ok ? (isDark ? '#9FD3B1' : '#1B7A33') : isDark ? '#E0B887' : '#7A5300',
      }}
    >
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" /> : <Info className="w-3.5 h-3.5 mt-px shrink-0" />}
      <span>
        {ok ? `Complaint registered with ${deptLabel(result.department || result.issue?.department)} — track it in ` : `${result.message} — `}
        <Link
          to={issueId ? `/issues/${issueId}` : '/issues'}
          className="font-medium underline"
        >
          {ok ? 'My Issues' : 'view the existing complaint'}
        </Link>
        .
      </span>
    </div>
  );
};

// Inline "Register a complaint" form under an assistant message. The
// department is pre-selected from the question that led to the reply; the
// server attaches the chat transcript itself.
const ComplaintForm = ({ chatId, question, isDark, onCancel, onFiled }) => {
  const dispatch = useDispatch();
  const allDepartments = useSelector((s) => s.department.departments);
  const departmentsLoading = useSelector((s) => s.department.loading);
  const departments = allDepartments.filter((d) => d.isActive !== false);
  const [departmentId, setDepartmentId] = useState('');
  const [details, setDetails] = useState('');
  const [suggesting, setSuggesting] = useState(!!question);
  const [suggested, setSuggested] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const hasDepartments = allDepartments.length > 0;
  // True once a department list has been loaded at least once, so "no
  // departments" isn't flashed before the first fetch even starts.
  const [checked, setChecked] = useState(hasDepartments);
  useEffect(() => {
    if (hasDepartments) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    dispatch(fetchDepartments()).finally(() => {
      if (!cancelled) setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, hasDepartments]);

  useEffect(() => {
    if (!question) return undefined;
    let cancelled = false;
    dispatch(fetchDepartmentSuggestion(question.slice(0, 2000)))
      .unwrap()
      .then((result) => {
        if (cancelled) return;
        const suggestion = result.success ? result.suggestion : null;
        if (suggestion?.departmentId) {
          setSuggested(suggestion);
          // Don't override a department the student already picked.
          setDepartmentId((cur) => cur || String(suggestion.departmentId));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSuggesting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, question]);

  const submit = async (e) => {
    e.preventDefault();
    if (!departmentId) {
      setError('Choose the department this complaint is for.');
      return;
    }
    if (!question && !details.trim()) {
      setError('Describe the problem in a few words.');
      return;
    }
    setError('');
    setSubmitting(true);
    const result = await dispatch(
      createIssueFromChat({ chatId, departmentId, details: details.trim() })
    ).unwrap();
    setSubmitting(false);
    const department = departments.find((d) => String(d._id) === String(departmentId));
    if (result.success && result.issue) {
      onFiled({ issue: result.issue, department });
    } else if (result.duplicate) {
      onFiled({ issue: result.existing, department, duplicate: true, message: result.message });
    } else {
      setError(result.message || 'Failed to register the complaint');
    }
  };

  const muted = isDark ? '#9AA5BD' : '#5A6372';
  const inputStyle = {
    backgroundColor: isDark ? '#0B1120' : '#F2F3F8',
    borderColor: isDark ? '#2A3656' : '#D8DAE6',
    color: isDark ? '#ECEEF5' : '#1F2330',
    colorScheme: isDark ? 'dark' : 'light',
  };
  const primary = isDark ? '#E63027' : '#1E2A66';
  const suggestedDept = suggested && departments.find((d) => String(d._id) === String(suggested.departmentId));
  // Nothing to file against: say so instead of showing an empty picker.
  const noDepartments = checked && !departmentsLoading && departments.length === 0;

  if (noDepartments) {
    return (
      <div
        className="mt-2 pt-2 border-t text-xs space-y-2"
        style={{ borderColor: isDark ? '#2A3656' : '#D8DAE6', color: muted }}
      >
        <p className="flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>No departments are set up yet — please contact the administration.</span>
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg border"
            style={{ borderColor: isDark ? '#2A3656' : '#D8DAE6', color: muted }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 pt-2 border-t space-y-2 text-sm"
      style={{ borderColor: isDark ? '#2A3656' : '#D8DAE6' }}
    >
      <div className="text-xs font-semibold" style={{ color: isDark ? '#ECEEF5' : '#1F2330' }}>
        Register a complaint
      </div>
      <div>
        <label className="flex items-center justify-between text-xs mb-1" style={{ color: muted }}>
          <span>Department</span>
          {suggesting ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Finding the right department…
            </span>
          ) : suggestedDept && String(suggestedDept._id) === String(departmentId) ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Suggested
            </span>
          ) : null}
        </label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={submitting}
          className="w-full px-2.5 py-1.5 text-sm rounded-lg border focus:outline-none"
          style={inputStyle}
        >
          <option value="">Select department…</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: muted }}>
          Details (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={MAX_DETAILS}
          rows={3}
          disabled={submitting}
          placeholder="Anything the department should know — dates, amounts, roll number…"
          className="w-full px-2.5 py-1.5 text-sm rounded-lg border focus:outline-none resize-y"
          style={inputStyle}
        />
        <p className="text-xs mt-0.5" style={{ color: muted }}>
          The chat transcript is attached automatically.
        </p>
      </div>
      {error && (
        <p className="text-xs" style={{ color: isDark ? '#F08D7B' : '#A8261B' }}>
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-50"
          style={{ borderColor: isDark ? '#2A3656' : '#D8DAE6', color: muted }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !departmentId}
          className="px-3 py-1.5 text-xs rounded-lg font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-50"
          style={{ backgroundColor: primary }}
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitting ? 'Registering…' : 'Submit complaint'}
        </button>
      </div>
    </form>
  );
};

export default ComplaintForm;
