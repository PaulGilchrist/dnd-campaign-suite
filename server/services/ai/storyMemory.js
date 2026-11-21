/**
 * Campaign log as AI memory (roadmap Step 9, owner vision 2026-11-21) — the
 * "Story so far" prompt section every AI role receives.
 *
 * Hierarchical memory: once a session has a `session_recap` row, the recap IS
 * its compressed memory — old raw rows for that session are dropped in favour
 * of it. The session the table is playing right now is always carried raw
 * (nothing may hide a live beat behind a stale recap). With no recaps yet,
 * the recent narrative-family rows are the history, newest-last.
 *
 * Reads the server-side log through the ONE loader (routes/log.js loadLog,
 * cache-first) — never a duplicate disk reader, never an HTTP loop. Row text
 * resolves through the canonical getEntryText accessor (message → description
 * → noteText → summary), so chip-stamped rows and composer rows both appear.
 */
import { loadLog, activeSessionName } from '../../routes/log.js';
// Canonical log-row text read, shared with the Log view (same cross-lane
// import precedent as worldContext.js and authoring/storyBible.js).
import { getEntryText } from '../../../src/components/log/log-utils.js';

// Narrative-family types the story slice draws from (session_recap rows are
// the compressed tier, handled separately below).
export const STORY_ROW_TYPES = new Set(['narrative', 'note', 'encounter']);
export const STORY_MAX_ROWS = 40;
export const STORY_CHAR_BUDGET = 1500;

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// One prompt line per row. Recaps get the biggest clip (they carry whole
// sessions); raw rows are beats, so a tighter one-liner keeps the budget for
// more of the story. Returns null for rows with no readable text.
// Recaps carry NO author token: `session_recap` is a SERVER-ONLY log type
// (routes/log.js SERVER_ONLY_LOG_TYPES) whose author is always GM, so `GM:`
// is pure noise there — raw rows keep theirs (a note may be player-authored).
function storyLine(entry) {
    if (entry.type === 'session_recap') {
        const text = clip(getEntryText(entry), 300);
        if (!text) return null;
        return `- recap of “${clip(entry.recapSession, 60)}”: ${text}`;
    }
    const text = clip(getEntryText(entry), 160);
    if (!text) return null;
    const who = entry.characterName ? `${clip(entry.characterName, 40)}: ` : '';
    return `- ${entry.type}: ${who}${text}`;
}

/**
 * Pure row→story composer (unit-testable without touching disks/caches).
 * @param {Array} rows full campaign log rows, oldest-first
 * @param {string|null} activeSession the session the table is playing now
 * @returns {string|null} the story block, or null when nothing qualifies
 *                        (prompts stay byte-identical for fresh campaigns)
 */
export function buildStoryFromRows(rows, activeSession) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    // Recaps of PRIOR sessions only — a recap of the live session must not
    // shadow the raw rows still being written.
    const recaps = rows.filter(e => e.type === 'session_recap' && e.recapSession && e.recapSession !== activeSession);
    const covered = new Set(recaps.map(r => r.recapSession));
    // Raw rows whose session a recap already compresses are dropped (hierarchy
    // law); everything else — the live session, unrecapped sessions, rows
    // written outside any tracked session (session: null) — stays raw.
    const rawRows = rows.filter(e => STORY_ROW_TYPES.has(e.type) && !covered.has(e.session));

    let selected;
    if (recaps.length > 0) {
        // Hierarchical: recap-compressed past + remaining raw rows
        // (the live session's included), newest-last.
        selected = [...recaps, ...rawRows];
    } else {
        // No recaps yet — the raw narrative history, newest-last.
        selected = rawRows;
    }
    let lines = selected.slice(-STORY_MAX_ROWS).map(storyLine).filter(Boolean);
    if (lines.length === 0) return null;

    // Char budget: drop OLDEST lines until the block fits (the freshest tail
    // is the most useful continuity for the model).
    while (lines.length > 1 && lines.join('\n').length > STORY_CHAR_BUDGET) lines = lines.slice(1);
    return lines.join('\n');
}

/**
 * Read the campaign's live log + active session server-side and compose the
 * story block. null ⇒ nothing to say yet (the AI prompt omits the section).
 */
export function buildStorySoFar(campaign) {
    return buildStoryFromRows(loadLog(campaign), activeSessionName(campaign));
}
