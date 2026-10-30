import { formatTimestamp } from './log-utils.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';

export function SaveResultEntry({ entry }) {
  const isSuccess = entry.success;
  return (
    <div className={`log-entry log-save-result-entry ${isSuccess ? 'log-save-result-success' : 'log-save-result-failure'}`}>
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-shield-halved"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">Saving Throw — {entry.targetName}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-save-result-details">
        <span className="log-save-info">
          {entry.saveType?.toUpperCase()} save DC {entry.saveDc}
        </span>
        <span className={`log-save-result ${isSuccess ? 'log-condition-success' : 'log-condition-failure'}`}>
          {isSuccess ? 'SAVE SUCCESS' : 'SAVE FAILURE'}
        </span>
        {entry.description && (
          <span className="log-save-result-description" dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.description) }} />
        )}
      </div>
    </div>
  );
}
