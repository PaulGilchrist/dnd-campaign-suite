/**
 * AI Campaign Authoring (plan Phase 1) — party reader for level-aware
 * generation. The designer must build arcs against the REAL party (owner
 * ruling: level ranges come from the character files, not the GM's memory).
 *
 * Character files are the campaign root *.json rows read by
 * campaigns-character.js (PlayerStats is the single source of truth); each
 * carries `level` (number) and `class.name` (+ subclass). Only files whose
 * shape looks like a character (name + level + class) are included, so stray
 * root JSON can never masquerade as a party member.
 */
import fs from 'fs';
import path from 'path';
import { campaignDir } from '../../../utils/campaignPaths.js';

export function readParty(campaign, { root } = {}) {
    const base = root || campaignDir(campaign);
    let files = [];
    try {
        files = fs.readdirSync(base).filter(f => f.endsWith('.json'));
    } catch {
        return [];
    }
    const party = [];
    for (const file of files) {
        let data;
        try {
            data = JSON.parse(fs.readFileSync(path.join(base, file), 'utf-8'));
        } catch {
            continue; // unreadable/partial file — not a party member
        }
        if (!data || typeof data !== 'object'
            || typeof data.level !== 'number'
            || !data.class || typeof data.class.name !== 'string') {
            continue;
        }
        party.push({
            name: data.name || path.basename(file, '.json'),
            level: data.level,
            class: data.class.name,
            subclass: data.class.subclass?.name || null,
            rules: data.rules || null,
        });
    }
    party.sort((a, b) => a.name.localeCompare(b.name));
    return party;
}

/** { min, max, size } over the party's levels — sizes the arc's CR budget. */
export function partyLevelRange(party) {
    if (!party.length) return { min: 1, max: 1, size: 0 };
    const levels = party.map(p => p.level);
    return { min: Math.min(...levels), max: Math.max(...levels), size: party.length };
}
