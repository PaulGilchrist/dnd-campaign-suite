import { formatTimestamp, formatEntryTypeLabel } from './log-utils.js';

// Generic fallback for entry types missing from Log.jsx's ENTRY_COMPONENTS
// registry (e.g. server-produced 'enforcement_denied' / 'ai_director' /
// 'ai_ruling' audit rows, or entries POSTed straight to the log API).
// Keeps the shared audit trail honest: nothing is stored-but-invisible.
export function GenericEntry({ entry }) {
  const typeLabel = formatEntryTypeLabel(String(entry.type ?? 'unknown'));
  // Prefer human-readable text fields; fall back to a JSON excerpt so even a
  // bare payload renders its content.
  const text = entry.message ?? entry.description ?? entry.noteText
    ?? JSON.stringify(Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'id')));
  return (
    <div className="log-entry log-generic">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-circle-info"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-generic-type">{typeLabel}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-generic-text">{text}</div>
    </div>
  );
}
