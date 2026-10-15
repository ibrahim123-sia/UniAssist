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
export const ComplaintResult = ({ result }) => {
  const issueId = result.issue?._id;
  const ok = !result.duplicate;
  return (
    <div
      className={`flex items-start gap-1.5 text-xs mt-2 px-2.5 py-1.5 rounded-control border ${
        ok
          ? 'bg-success-bg text-success border-success-border'
          : 'bg-warning-bg text-warning border-warning-border'
      }`}
    >
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" /> : <Info className="w-3.5 h-3.5 mt-px shrink-0" />}
      <span>
        {ok ? `Complaint registered with ${deptLabel(result.department || result.issue?.department)} — track it in ` : `${result.message} — `}
        <Link
          to={issueId ? `/issues/${issueId}` : '/issues'}
          className="font-semibold underline focus-ring rounded"
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
const ComplaintForm = ({ chatId, question, onCancel, onFiled }) => {
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

  const suggestedDept = suggested && departments.find((d) => String(d._id) === String(suggested.departmentId));
  // Nothing to file against: say so instead of showing an empty picker.
  const noDepartments = checked && !departmentsLoading && departments.length === 0;

  if (noDepartments) {
    return (
      <div
        className="mt-2 pt-2 border-t border-border text-xs space-y-2 text-muted"
      >
        <p className="flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>No departments are set up yet — please contact the administration.</span>
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors"
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
      className="mt-2 pt-2 border-t border-border space-y-2 text-sm"
    >
      <div className="text-xs font-bold text-heading">
        Register a complaint
      </div>
      <div>
        <label className="flex items-center justify-between text-xs font-semibold mb-1 text-label">
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
          className="w-full px-2.5 py-1.5 text-sm rounded-control border bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)] disabled:opacity-60"
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
        <label className="block text-xs font-semibold mb-1 text-label">
          Details (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={MAX_DETAILS}
          rows={3}
          disabled={submitting}
          placeholder="Anything the department should know — dates, amounts, roll number…"
          className="w-full px-2.5 py-1.5 text-sm rounded-control border resize-y bg-input-bg border-input-border text-text placeholder:text-placeholder focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)] disabled:opacity-60"
        />
        <p className="text-xs mt-0.5 text-muted">
          The chat transcript is attached automatically.
        </p>
      </div>
      {error && (
        <p className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 text-xs font-semibold rounded-control bg-surface border border-border-strong text-label hover:bg-nav-hover focus-ring transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !departmentId}
          className="px-3 py-1.5 text-xs rounded-control font-bold inline-flex items-center gap-1.5 bg-primary text-on-primary hover:bg-primary-hover focus-ring disabled:bg-disabled-bg disabled:text-disabled-text transition-colors"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitting ? 'Registering…' : 'Submit complaint'}
        </button>
      </div>
    </form>
  );
};

export default ComplaintForm;
