/**
 * Roadmap Step 8 — session recap context (owner vision 2026-11-21: "the AI
 * uses the campaign log as memory and posts an enthralling story of each
 * played session").
 *
 * Gathers every log row stamped to ONE session (the server-side `session`
 * stamp, see routes/log.js addEntry) and compacts it into a token-budgeted
 * transcript for the recap prompt. Priority law: narrative/encounter/
 * milestone rows ARE the story and ride first; high-signal combat rows give
 * the plot its stakes; per-roll rows are noise and only fill leftover budget.
 *
 * Text resolves through the canonical getEntryText accessor; rows read through
 * the one log loader (cache-first) — no second disk reader, no HTTP loop.
 */
import { loadLog } from '../../routes/log.js';
import { getEntryText } from '../../../src/components/log/log-utils.js';

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Milestone tier: the story skeleton — prose, encounters, session lifecycle,
// rests, loot, deaths.
const MILESTONE_TYPES = new Set([
    'narrative', 'note', 'encounter', 'session_recap', 'session-played',
    'session_phase', 'session_active', 'long_rest', 'short_rest', 'loot',
    'death_save',
]);
// Signal tier: who hurt/controlled whom — enough structure for faithful
// combat beats without dumping every die.
const SIGNAL_TYPES = new Set([
    'hp_change', 'healing', 'spell', 'spell_effect', 'condition', 'buff',
    'summons', 'ability_use', 'metamagic', 'metamagic_use', 'save_result',
]);

export const RECAP_CHAR_BUDGET = 8000;
const CLIP_LEN = { milestone: 240, signal: 140, noise: 90 };

function tierOf(entry) {
    if (MILESTONE_TYPES.has(entry.type)) return 'milestone';
    if (SIGNAL_TYPES.has(entry.type)) return 'signal';
    return 'noise';
}

// Prose types ARE their text — an actor arrow would only repeat the author
// the sentence already names; structured rows get the facts the prose lacks.
const PROSE_TYPES = new Set(['narrative', 'note', 'session_recap', 'session-played', 'session_phase', 'session_active']);

// Damage/heal phrasing for the two wire shapes: stamped damage rows carry
// finalDamage, hp_change rows carry a signed delta.
function damageFact(entry) {
    if (typeof entry.finalDamage === 'number' && entry.finalDamage !== 0) return `${entry.finalDamage} damage`;
    if (typeof entry.delta === 'number' && entry.delta !== 0) {
        return entry.delta < 0 ? `${-entry.delta} damage` : `+${entry.delta} healed`;
    }
    return null;
}

// Key structured fields the prose alone misses: attacker → target, the hit/
// miss verdict, the damage/heal number, the outcome word (dead / Prone / …).
function outcomeFacts(entry) {
    if (PROSE_TYPES.has(entry.type)) return [];
    const facts = [];
    const actor = entry.characterName || entry.name || null;
    if (actor) facts.push(entry.targetName ? `${clip(actor, 40)} → ${clip(entry.targetName, 40)}` : clip(actor, 40));
    if (typeof entry.hit === 'boolean') facts.push(entry.hit ? 'hit' : 'missed');
    const damage = damageFact(entry);
    if (damage) facts.push(damage);
    if (entry.result) facts.push(clip(entry.result, 30));
    if (entry.condition) facts.push(clip(entry.condition, 30));
    return facts;
}

function compactLine(entry, clipLen) {
    const text = clip(getEntryText(entry), clipLen);
    const facts = outcomeFacts(entry).join(', ');
    if (!text && !facts) return null;
    return `[${entry.type}] ${[text, facts].filter(Boolean).join(' — ')}`;
}

/** Every row whose server stamp equals this session name, oldest-first. */
export function gatherSessionRows(campaign, sessionName) {
    return loadLog(campaign).filter(e => e.session === sessionName);
}

/**
 * Compact the session into a sectioned, budget-guarded transcript.
 * @returns {{ totalRows: number, included: number, transcript: string }}
 */
export function buildRecapTranscript(campaign, sessionName, budget = RECAP_CHAR_BUDGET) {
    const rows = gatherSessionRows(campaign, sessionName);
    const tiers = { milestone: [], signal: [], noise: [] };
    for (const entry of rows) tiers[tierOf(entry)].push(entry);

    let used = 0;
    let included = 0;
    const sections = [];
    const takeTier = (list, title) => {
        const lines = [];
        for (const entry of list) {
            const line = compactLine(entry, CLIP_LEN[tierOf(entry)]);
            if (!line) continue;
            if (used + line.length + 1 > budget) continue; // noise (last tier) simply runs out of room
            lines.push(line);
            used += line.length + 1;
            included++;
        }
        if (lines.length) sections.push(`${title}:\n${lines.join('\n')}`);
    };
    takeTier(tiers.milestone, 'STORY BEATS (narrative, encounters, milestones)');
    takeTier(tiers.signal, 'ACTION BEATS (combat and effects)');
    takeTier(tiers.noise, 'ROLL DETAIL');

    return { totalRows: rows.length, included, transcript: sections.join('\n\n') };
}
