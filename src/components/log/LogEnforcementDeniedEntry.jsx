import { formatTimestamp, formatEntryTypeLabel } from './log-utils.js';

// Gameplay-lane enforcement refusals (backlog 2026-11-21 GGG attribution).
// Every enforcement_denied producer (assertCanAct, lineOfSightGate,
// opportunityTrigger, usePlayerDragging) stamps the same shape:
// {creature, target?, bucket, source, reason} — the row's own `reason` is the
// canonical refusal sentence. The lane-derived `message` stamp from
// logService.stampAuditText is only the bare category label (producers carry
// no LOG_TEXT_FIELDS text), which is why the generic fallback triple-printed
// "Enforcement Denied" with zero attribution. This row renders ONE attributed
// line — `creature → target: reason` — with the label shown exactly once.
export function EnforcementDeniedEntry({ entry }) {
  const typeLabel = formatEntryTypeLabel(String(entry.type ?? 'enforcement_denied'));
  // Producers always stamp the full sentence; fall back honestly for rows
  // missing it rather than dumping raw JSON (LogWriteRejectedEntry idiom).
  const reason = entry.reason || 'Action refused by enforcement.';
  const actor = entry.creature
    ? (entry.target ? `${entry.creature} → ${entry.target}` : entry.creature)
    : null;
  return (
    <div className="log-entry log-enforcement-denied">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-ban"></i></span>
        <span className="log-enforcement-denied-type">{typeLabel}</span>
        {entry.bucket ? <span className="log-enforcement-denied-bucket">{entry.bucket}</span> : null}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-enforcement-denied-text">
        {actor ? `${actor}: ${reason}` : reason}
      </div>
    </div>
  );
}
