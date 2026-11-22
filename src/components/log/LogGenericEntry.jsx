import { formatTimestamp, formatEntryTypeLabel, getEntryText } from './log-utils.js';

// Generic fallback for entry types missing from Log.jsx's ENTRY_COMPONENTS
// registry (e.g. entries POSTed straight to the log API, or future types
// before they get a dedicated row). Keeps the shared audit trail honest:
// nothing is stored-but-invisible. The ai_* audit family renders through
// AiAuditEntry instead (family unification 2026-11-22).
export function GenericEntry({ entry }) {
  const typeLabel = formatEntryTypeLabel(String(entry.type ?? 'unknown'));
  // Prefer the canonical readable text (getEntryText resolves the stamped-
  // `message` roll/hp_change rows and the join `description` rows through one
  // documented precedence); fall back to a JSON excerpt so even a bare
  // payload renders its content.
  const text = getEntryText(entry)
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
