/**
 * AI Campaign Authoring (plan Phase 4) — the STORY BIBLE.
 *
 * The designer's memory of "what this campaign actually is". For extension
 * work (levels 6–10 continuing an existing story, session-4 prep) this is the
 * difference between a sequel and amnesia: the model must see approved
 * content with real state — which quests are completed vs dangling, what the
 * party is right now (character files, not the GM's memory), session
 * outcomes, maps on file, recent table log, and the design intent captured
 * in design-notes.json from earlier collaborations.
 *
 * DRAFT rows are excluded — the bible describes the CANON the drafts are
 * measured against; letting a rejected-pending draft anchor continuity would
 * let the AI tie every later draft to content that may never be approved.
 */
import fs from 'fs';
import path from 'path';
import { campaignDir } from '../../../utils/campaignPaths.js';
import { readJson, BESTIARY_FILE } from './referential.js';
import { readParty, partyLevelRange } from './party.js';

const clip = (s, n = 160) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function approvedRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter(r => r && r.draft !== true);
}

/**
 * @param {{ root?: string, notes?: object }} opts — root for fixtures/tests;
 * notes = parsed design-notes.json (caller owns that file's lifecycle).
 */
export function buildStoryBible(campaign, { root, notes = null } = {}) {
    const base = root || campaignDir(campaign);
    const dataFile = name => path.join(base, 'data', name);

    const quests = approvedRows(readJson(dataFile('quests.json'), []));
    const factions = approvedRows(readJson(dataFile('factions.json'), []));
    const npcs = approvedRows(readJson(dataFile('npcs.json'), []));
    const settlements = approvedRows(readJson(dataFile('settlements.json'), []));
    const sessions = approvedRows(readJson(dataFile('sessions.json'), []));
    const encounters = approvedRows(readJson(dataFile('encounters.json'), { encounters: [] }).encounters);
    const log = readJson(dataFile('campaign-log.json'), []);

    let maps = [];
    try {
        maps = fs.readdirSync(path.join(base, 'maps'))
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace(/\.json$/, ''));
    } catch { /* no maps yet */ }

    const party = readParty(campaign, { root: base });
    const byStatus = (...statuses) => quests.filter(q => statuses.includes(q.status || 'active'));

    return {
        party,
        partyLevels: partyLevelRange(party),
        quests: {
            active: byStatus('active').map(q => ({ name: q.name, description: clip(q.description, 100) })),
            completed: byStatus('completed').map(q => ({ name: q.name })),
            failed: byStatus('failed').map(q => ({ name: q.name })),
        },
        factions: factions.map(f => ({ name: f.name, influence: f.influence ?? null, goals: clip(f.goals, 120) })),
        npcs: npcs.map(n => ({
            name: n.name,
            role: [n.race, n.classRole].filter(Boolean).join(' ') || null,
            attitude: n.attitude || null,
            goals: clip(n.goals, 100),
            secrets: clip(n.secrets, 100),
        })),
        settlements: settlements.map(s => ({ name: s.name, size: s.size || null, threat: clip(s.threat, 140) })),
        sessions: sessions
            .slice()
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
            .map(s => ({ name: s.name, date: s.date || null, status: s.status || 'planned', summary: clip(s.summary, 160) })),
        encounters: encounters.slice(-15).map(e => ({ name: e.name, monsters: (e.selectedMonsters || []).map(m => `${m.name}×${m.qty}`) })),
        maps,
        recentLog: log.slice(-25).map(e => ({ type: e.type || '', text: clip(e.description || e.text, 140) })),
        designIntent: notes ? {
            storySummary: notes.storySummary || null,
            lastPlans: (notes.plans || []).slice(-3),
        } : null,
    };
}

/**
 * CR-banded bestiary menu for the generator prompt: real `index`+`name`
 * pairs the model may legitimately cite in encounter.selectedMonsters
 * (referential.js rejects anything else). Band = [minCr, maxCr]; pass the
 * party range (or the arc's target levels) so the menu stays small enough to
 * obey AND relevant enough to be tempting.
 */
export function monsterMenu({ minCr = 0, maxCr = 30, limit = 150 } = {}) {
    const all = readJson(BESTIARY_FILE, []);
    const crOf = (m) => Number(m.challenge_rating); // bestiary stores CR as strings ("0.25")
    return (Array.isArray(all) ? all : [])
        .filter(m => Number.isFinite(crOf(m)) && crOf(m) >= minCr && crOf(m) <= maxCr)
        .sort((a, b) => crOf(a) - crOf(b))
        .slice(0, limit)
        .map(m => ({ index: m.index, name: m.name, cr: crOf(m) }));
}
