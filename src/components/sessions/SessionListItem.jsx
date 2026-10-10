import { checklistProgress, countLinks } from '../../services/campaign/sessionPlannerUtils.js';

function SessionListItem({ session, onEdit }) {
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
          {session.date && <span className="sessions-list-date"><i className="fa-solid fa-calendar" /> {session.date}</span>}
        </div>
        <div className="ct-list-meta">
          <span className={`sessions-status-badge${played ? ' sessions-status-played' : ' sessions-status-planned'}`}>
            <i className={`fa-solid ${played ? 'fa-circle-check' : 'fa-hourglass-half'}`} />
            {played ? 'Played' : 'Planned'}
          </span>
        </div>
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
      </div>
      {preview && <p className="ct-list-preview">{preview}</p>}
    </li>
  );
}

export default SessionListItem;
