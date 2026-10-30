import { formatTimestamp } from './log-utils.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';

export function AbilityUseEntry({ entry }) {
  const hasSaveDetails = entry.saveRoll != null;
  const hasDeathSave = entry.deathSaveRoll != null;
  return (
    <div className="log-entry log-ability-use">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-bolt"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-name">{entry.abilityName}</span>
        {entry.source && entry.source !== entry.abilityName && <span className="log-source-tag">{entry.source}</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-ability-details">
        {entry.description && <span className="log-ability-description" dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.description) }} />}
        {hasSaveDetails && (
          <div className="log-ability-save-details">
            <span className={`log-die log-die-selected`}>({entry.saveRoll})</span>
            <span className="log-save-info">+{entry.saveBonus} = {entry.saveTotal} vs DC {entry.saveDc}</span>
            <span className={`log-save-result ${entry.saveSuccess ? 'log-condition-success' : 'log-condition-failure'}`}>
              {entry.saveSuccess ? 'SUCCESS' : 'FAILURE'}
            </span>
            {entry.hpGained != null && (
              <span className="log-hp-gained">+{entry.hpGained} HP</span>
            )}
          </div>
        )}
        {hasDeathSave && (
          <div className="log-ability-death-save">
            <span className="log-icon-inline"><i className="fas fa-skull-crossbones"></i></span>
            <span>Death Save: </span>
            <span className={`log-die ${entry.deathSaveSuccess ? 'log-die-selected' : ''}`}>({entry.deathSaveRoll})</span>
            <span className={`log-save-result ${entry.deathSaveSuccess ? 'log-condition-success' : 'log-condition-failure'}`}>
              {entry.deathSaveSuccess ? 'SUCCESS' : 'FAILURE'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
