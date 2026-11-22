/**
 * AI Campaign Authoring (plan Phase 4) — the designer conversation ledger.
 *
 * Lives at data/design-notes.json inside the CAMPAIGN folder (owner ruling):
 * the brainstorm is campaign memory — it travels with downloads and
 * snapshots, and the next sitting (or next year's arc extension) continues
 * the same thread. Shape:
 *   { storySummary?, messages: [{ role, content, at }], plans: [scope…],
 *     pendingPlan?: scope + savedAt, lastError?: { stage, error, at } }
 *
 * `pendingPlan` is the GM's un-revised build plan (with their count edits) and
 * `lastError` the last failed plan/generate/chat attempt — both ride here so
 * switching views or reloading the page never silently discards them
 * (backlog 2026-10-31 designer-plan-state-volatile). Consumed (generate
 * succeeded) or explicitly cleared → back to null. Writes that echo the
 * `savedAt` stamp they loaded obey a freshness compare — a stale echo is
 * refused with a conflict, never silently clobbering a newer save (backlog
 * 2026-11-22 designer-pending-plan-freshness).
 *
 * This is raw-fs, NOT the change-data runtime store: like every entity list
 * lane (quests/npcs/…), it is a whole-file document the GM-side designer
 * owns; it is never part of a player's synced state.
 */
import fs from 'fs';
import { campaignDataFile, ensureDataDir } from '../../../utils/campaignPaths.js';
import { readJson } from './referential.js';

const FILE = 'design-notes.json';
const BLANK = { storySummary: null, messages: [], plans: [], pendingPlan: null, lastError: null };
const MAX_MESSAGES = 200; // keep the file (and prompt replay) bounded

export function loadNotes(campaign) {
    const parsed = readJson(campaignDataFile(campaign, FILE), null);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.messages)) {
        return { ...BLANK, messages: [], plans: [] };
    }
    return { ...BLANK, ...parsed };
}

function writeNotes(campaign, notes) {
    ensureDataDir(campaign);
    fs.writeFileSync(campaignDataFile(campaign, FILE), JSON.stringify(notes, null, 2));
}

/**
 * Blank the whole ledger (Admin-adjacent "Clear Designer Conversation" lane,
 * backlog 2026-11-07): the BLANK shape written verbatim so a chat/plan/error
 * residue cannot outlive the campaign cleanup ritual. Deliberately touches
 * ONLY design-notes.json — snapshots and every other campaign file stay.
 */
export function clearNotes(campaign) {
    const blank = { ...BLANK, messages: [], plans: [] };
    writeNotes(campaign, blank);
    return blank;
}

export function appendMessages(campaign, ...entries) {
    const notes = loadNotes(campaign);
    const now = Date.now();
    notes.messages.push(...entries.map(e => ({ role: e.role, content: String(e.content || ''), at: now })));
    if (notes.messages.length > MAX_MESSAGES) {
        notes.messages = notes.messages.slice(-MAX_MESSAGES);
    }
    writeNotes(campaign, notes);
    return notes;
}

export function recordPlan(campaign, scope, { storySummary } = {}) {
    const notes = loadNotes(campaign);
    notes.plans = [...(notes.plans || []), { ...scope, proposedAt: Date.now() }].slice(-10);
    if (storySummary) notes.storySummary = String(storySummary).slice(0, 8000);
    writeNotes(campaign, notes);
    return notes;
}

/**
 * Persist (or clear) the GM's pending build plan so view navigation and page
 * reloads never discard it. `scope` null/non-object clears the pending entry.
 *
 * Freshness contract (backlog 2026-11-22, mirrors the NPC lane's updatedAt
 * tripwire): a caller that loaded the plan echoes the `savedAt` stamp it saw
 * via `baseSavedAt`. If a stored plan carries a DIFFERENT stamp, another tab
 * saved since this caller read — return `{ conflict: true, notes }` and write
 * NOTHING (the route turns it into a plain-English 409). No echoed stamp
 * (fresh never-loaded editor) or no stored plan means nothing to be stale
 * against, so the write proceeds — this is also how the server-side plan /
 * generate lanes keep writing unconditionally.
 */
export function savePendingPlan(campaign, scope, { baseSavedAt } = {}) {
    const notes = loadNotes(campaign);
    if (typeof baseSavedAt === 'number' && notes.pendingPlan
        && baseSavedAt !== notes.pendingPlan.savedAt) {
        return { conflict: true, notes };
    }
    notes.pendingPlan = (scope && typeof scope === 'object' && !Array.isArray(scope))
        ? { ...scope, savedAt: Date.now() }
        : null;
    writeNotes(campaign, notes);
    return notes;
}

/** Record the last failed designer attempt (or clear it on success). */
export function setDesignerError(campaign, stage, error) {
    const notes = loadNotes(campaign);
    if (!error && !notes.lastError) return notes; // success with nothing to clear — stay write-silent
    notes.lastError = error
        ? { stage: String(stage || 'unknown'), error: String(error).slice(0, 2000), at: Date.now() }
        : null;
    writeNotes(campaign, notes);
    return notes;
}

export { FILE as DESIGN_NOTES_FILE };
