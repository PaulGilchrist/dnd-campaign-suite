import { formatTimestamp, getEntryText } from './log-utils.js';
import { renderMarkdown } from '../../services/ui/sanitize.js';

// Narrative rows — GM/referee prose posted from the Log composer or the AI
// world-console confirm lane (always authored `GM`, see the manual-author gate
// in server/routes/log.js). Prose is first-class memory for the session-recap
// vision, so it renders as readable markdown (marked + DOMPurify via
// services/ui/sanitize.js), not the generic one-line fallback.
// Canonical text field: `description` (read through getEntryText, the one
// documented text accessor). `name` is the optional in-world speaker label
// the world keeper stamps on npc_dialogue rows.
export function NarrativeEntry({ entry }) {
  const html = renderMarkdown(getEntryText(entry) || '');
  return (
    <div className="log-entry log-narrative">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-feather-pointed"></i></span>
        <span className="log-character">{entry.characterName}</span>
        {entry.name && <span className="log-narrative-speaker">{entry.name}</span>}
        {entry.session && <span className="log-entry-session" title="Campaign session">{entry.session}</span>}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-narrative-text" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// Session recap rows (roadmap Step 8) — the AI's enthralling story of one
// played session, posted server-side by the recap endpoint as `GM`. Same
// sanitized-markdown body as NarrativeEntry, plus a title naming the session
// it describes. Stamping law (pinned in server recap tests): `session` is the
// server-controlled stamp of WHEN the row was written; `recapSession` is the
// explicit subject — which session this recap tells the story of. The title
// and the AI's hierarchical memory key off `recapSession`, never the stamp.
export function RecapEntry({ entry }) {
  const html = renderMarkdown(getEntryText(entry) || '');
  return (
    <div className="log-entry log-narrative log-recap">
      <div className="log-entry-header">
        <span className="log-icon"><i className="fas fa-scroll"></i></span>
        <span className="log-character">{entry.characterName}</span>
        <span className="log-recap-title">
          Session Recap{entry.recapSession ? ` — ${entry.recapSession}` : ''}
        </span>
        {entry.session && (
          <span className="log-entry-session" title="Session active when this recap was written">
            {entry.session}
          </span>
        )}
        <span className="log-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="log-narrative-text" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
