import { checklistProgress, countLinks, hasNotes } from '../../services/campaign/sessionPlannerUtils.js';
import DraftFlag from '../common/DraftFlag.jsx';

// Status badges, extracted so SessionListItem stays under the complexity
// ceiling; the Active badge marks the session new campaign log rows are
// stamped with (log memory lane, 2026-11-21).
function SessionMetaBadges({ played, isActive }) {
  return (
    <div className="ct-list-meta">
      {isActive && (
        <span className="sessions-status-badge sessions-status-active" title="Active session — new campaign log rows are stamped with this name">
          <i className="fa-solid fa-book-open" /> Active
        </span>
      )}
      <span className={`sessions-status-badge${played ? ' sessions-status-played' : ' sessions-status-planned'}`}>
        <i className={`fa-solid ${played ? 'fa-circle-check' : 'fa-hourglass-half'}`} />
        {played ? 'Played' : 'Planned'}
      </span>
    </div>
  );
}

function SessionListItem({ session, isActive = false, onEdit, onPrint = null }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onEdit(session);
    }
  };
  const { done, total, pct } = checklistProgress(session.checklist);
  const played = session.status === 'played';
  const preview = session.summary
    ? (session.summary.length > 120 ? session.summary.substring(0, 120) + '…' : session.summary)
    : null;

  return (
    <li
      className="ct-list-item"
      onClick={() => onEdit(session)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Edit session: ${session.name}`}
    >
      <div className="sessions-list-header">
        <div className="sessions-list-name-row">
          <span className="ct-list-name">{session.name}</span>
          <DraftFlag row={session} />
          {session.date && <span className="sessions-list-date"><i className="fa-solid fa-calendar" /> {session.date}</span>}
        </div>
        <SessionMetaBadges played={played} isActive={isActive} />
      </div>
      <div className="ct-list-details">
        <div className="sessions-progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={`Checklist ${done} of ${total} complete`}>
          <div className="sessions-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="sessions-progress-label">{done}/{total} ready</span>
        {countLinks(session.links) > 0 && (
          <span className="sessions-list-links">
            <i className="fa-solid fa-link" /> {countLinks(session.links)} linked
          </span>
        )}
        {(session.contingencies || []).length > 0 && (
          <span className="sessions-list-contingencies">
            <i className="fa-solid fa-code-branch" /> {(session.contingencies || []).length} contingenc{(session.contingencies || []).length === 1 ? 'y' : 'ies'}
          </span>
        )}
        {hasNotes(session.notes) && (
          <span className="sessions-list-notes" title="Has notes" aria-label="Has notes">
            <i className="fa-solid fa-note-sticky" />
          </span>
        )}
        {/* Item 4 handout (F12: labeled): the saved row prints as-is — pure
            presentation, no planner open, no writes. */}
        {onPrint && (
          <button
            className="sessions-print-btn ct-btn ct-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onPrint(session);
            }}
            title={`Print ${session.name}'s one-pager`}
            aria-label={`Print one-pager for ${session.name}`}
          >
            <i className="fa-solid fa-print" /> Print One-Pager
          </button>
        )}
      </div>
      {preview && <p className="ct-list-preview">{preview}</p>}
    </li>
  );
}

export default SessionListItem;
