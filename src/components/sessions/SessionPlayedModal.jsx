// @maintained-by-ai
// Mark-as-Played recap prompt (QA backlog 2026-11-24: retires the lane's native
// window.prompt, which blocked the automation harness until browser_handle_dialog
// and gave the input no in-app Preview). Rides the shared DeleteConfirmModal
// role="dialog" chrome exactly like the delete-confirm family (Escape/backdrop/
// Cancel zero-write, Tab trap, initial focus on the dialog's first focusable
// element). Because this dialog is a PROMPT, the first focusable element is the
// recap textarea — children render before the action row, so the family's
// focus law lands the user straight on the input. The Preview line is the exact
// text the confirm writes: both lanes call buildSessionPlayedLogText (shared
// with sessionPlannerUtils), so preview and campaign-log row can never drift.
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
import { buildSessionPlayedLogText } from '../../services/campaign/sessionPlannerUtils.js';

// `pendingSession` is the staged editingSession (null = closed). The displayed
// name mirrors the confirm path's law: the LIVE form name when typed, else the
// row's original — so the Preview names exactly what the row will write.
function SessionPlayedModal({ pendingSession, formData, recap, onRecapChange, onCancel, onConfirm }) {
  if (!pendingSession) return null;
  const sessionName = (formData?.name || '').trim() || pendingSession.name;
  return (
    <DeleteConfirmModal
      titleId="sessions-played-title"
      title="Mark Session as Played"
      confirmLabel="Confirm"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <label className="sessions-played-recap-label" htmlFor="session-played-recap">
        Session recap (optional) — added to the campaign log:
      </label>
      <textarea
        id="session-played-recap"
        className="ct-textarea sessions-played-recap-input"
        rows={2}
        value={recap}
        onChange={(e) => onRecapChange(e.target.value)}
        placeholder="How did it go?"
      />
      {/* PHRASING children only: the shared shell renders children inside a
          <p>, and React throws a hydration error for <div> in <p> (live on the
          first ride of this dialog). The spans are block-display via CSS. */}
      <span className="sessions-played-preview" aria-live="polite">
        <span className="sessions-played-preview-label">Preview</span>
        <span className="sessions-played-preview-row">
          {buildSessionPlayedLogText(sessionName, recap)}
        </span>
      </span>
    </DeleteConfirmModal>
  );
}

export default SessionPlayedModal;
