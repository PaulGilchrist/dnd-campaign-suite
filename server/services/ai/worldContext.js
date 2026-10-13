/**
 * Level 5 Phase 3 (plan §9.4) — world context for the AI world keeper.
 *
 * Reads the campaign's own world ledger (quests / factions / NPCs /
 * settlements / notes / recent log) from disk and compacts it into a
 * small prompt context + the ALLOWLISTS the schema enforces: the model may
 * only reference entities that actually exist in the campaign (canonical
 * names), and it only ever GENERATES payloads — the referee confirms and
 * the normal CRUD lanes write (§9.5).
 */
import fs from 'fs';
import { campaignDataFile } from '../../utils/campaignPaths.js';

// No slashes/dots — the file name is fixed by the caller, this guards the
// campaign segment itself against traversal.
const SAFE_CAMPAIGN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

function readList(campaign, fileName) {
    if (!SAFE_CAMPAIGN.test(campaign)) return [];
    try {
        const raw = JSON.parse(fs.readFileSync(campaignDataFile(campaign, fileName), 'utf8'));
        return Array.isArray(raw) ? raw : [];
    } catch {
        return []; // missing/corrupt file is a blank page, not a crash
    }
}

const clip = (s, n = 140) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * @returns {{ context: object, allow: { npcNames:string[], settlementNames:string[], factionNames:string[], questNames:string[] } }}
 */
export function loadWorldState(campaign, changeData = {}) {
    const quests = readList(campaign, 'quests.json');
    const factions = readList(campaign, 'factions.json');
    const npcs = readList(campaign, 'npcs.json');
    const settlements = readList(campaign, 'settlements.json');
    const notes = readList(campaign, 'notes.json');
    const log = readList(campaign, 'campaign-log.json');

    const worldQuests = quests.slice(-12).map(q => ({ name: q.name, status: q.status || 'active', description: clip(q.description, 100) }));
    const worldFactions = factions.slice(0, 10).map(f => ({ name: f.name, influence: f.influence ?? null, goals: clip(f.goals, 100) }));
    const worldNpcs = npcs.slice(0, 20).map(n => ({ name: n.name, alignment: n.alignment || null, personality: clip(n.personality || n.description, 90) }));
    const worldSettlements = settlements.slice(0, 10).map(s => ({ name: s.name, threat: s.threat || null, rumor: clip((s.rumors || [])[0], 90) }));
    const recentNotes = notes
        .slice()
        .sort((a, b) => String(b.dateModified || '').localeCompare(String(a.dateModified || '')))
        .slice(0, 6)
        .map(n => ({ title: n.name || clip(n.description, 40), body: clip(n.description, 120) }));
    const recentLog = (Array.isArray(changeData.log) ? changeData.log : log)
        .slice(-14)
        .map(e => ({ type: e.type || '', text: clip(e.description || e.text, 120) }));

    return {
        context: {
            quests: worldQuests,
            factions: worldFactions,
            npcs: worldNpcs,
            settlements: worldSettlements,
            recentNotes,
            recentLog,
        },
        allow: {
            questNames: quests.map(q => q.name),
            factionNames: factions.map(f => f.name),
            npcNames: npcs.map(n => n.name),
            settlementNames: settlements.map(s => s.name),
        },
    };
}
