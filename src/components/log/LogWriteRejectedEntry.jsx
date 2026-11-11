import { formatTimestamp, formatEntryTypeLabel } from './log-utils.js';

// Server-validator write refusals (GC improve 2026-11-10, backlog audit
// legibility). Rejected change-data writes log their own row type
// 'write_rejected' ({origin:'server-validator', key, reason, description} —
// server/routes/campaigns-changedata.js) so a filter on the gameplay-lane
// 'enforcement_denied' rows (creature/bucket/source) stays rules-only.
// Renders one readable line: label + rejected key chip + refusal sentence.
export function WriteRejectedEntry({ entry }) {
  const typeLabel = formatEntryTypeLabel(String(entry.type ?? 'write_rejected'));
  // Producers always stamp the full sentence; fall back honestly for rows
  // missing it rather than dumping raw JSON.
  const detail = entry.description ?? entry.reason ?? 'Server rejected the write.';
  return (
    <div className="log-entry log-write-rejected">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-ban"></i></span>
        <span className="log-write-rejected-type">{typeLabel}</span>
        {entry.key ? <span className="log-write-rejected-key">{entry.key}</span> : null}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-write-rejected-text">{detail}</div>
    </div>
  );
}
