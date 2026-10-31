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
 * succeeded) or explicitly cleared → back to null.
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
 */
export function savePendingPlan(campaign, scope) {
    const notes = loadNotes(campaign);
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
