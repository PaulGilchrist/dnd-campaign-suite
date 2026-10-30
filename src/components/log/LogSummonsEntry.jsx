import { formatTimestamp } from './log-utils.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';

export function SummonsEntry({ entry }) {
  return (
    <div className="log-entry log-summons">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-horse"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">Summons — {entry.summonName}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-summons-details">
        {entry.description && <span className="log-summons-description" dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.description) }} />}
        {entry.summonedCreatures && entry.summonedCreatures.length > 0 && (
          <div className="log-summons-creatures">
            <span className="log-summons-label">Creatures:</span>
            {entry.summonedCreatures.map((creature, i) => (
              <span key={i} className="log-summons-creature">
                {i > 0 && ', '}{creature}
              </span>
            ))}
          </div>
        )}
        {entry.duration && (
          <span className="log-summons-duration">Duration: {entry.duration}</span>
        )}
      </div>
    </div>
  );
}
