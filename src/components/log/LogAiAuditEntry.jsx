import { formatTimestamp, formatEntryTypeLabel, formatAiAuditLine } from './log-utils.js';

// AI audit rows — the whole ai_* family (designer/refine/world/authoring/
// dress/director/ruling/draft-review + applied variants, backlog
// ai-audit-log-rows-raw-json; family unification 2026-11-22). Producers stamp
// structured payload fields or an authored description, so these would
// otherwise fall through to the generic row's raw-JSON excerpt. Renders one
// human-readable line via formatAiAuditLine (verbatim description when
// present, else kind + instruction/request + outcome from the describers).
// Plain JSX text like GenericEntry — React escaping keeps user/model text
// inert.
export function AiAuditEntry({ entry }) {
  const typeLabel = formatEntryTypeLabel(String(entry.type ?? 'unknown'));
  return (
    <div className="log-entry log-ai-audit">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-robot"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-ai-audit-type">{typeLabel}</span>
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-ai-audit-text">{formatAiAuditLine(entry)}</div>
    </div>
  );
}
