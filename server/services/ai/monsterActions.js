/**
 * Level 5 Phase 3 (plan §9.3) — monster action allowlist.
 *
 * The AI director may only propose actions the monster ACTUALLY HAS: this
 * module is the contract. It reads public/data/monsters.json once (cached),
 * resolves combat-instance names ('Goblin 1') to stat blocks ('Goblin'), and
 * exposes the action list + speed that the schema validator enforces. A name
 * with no stat block resolves to null — the director then fails closed to
 * needs_human (the GM directs that one by hand).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../public/data/monsters.json');

let cache = null; // lowercase name → monster (reloaded per process only)

function monsterIndex() {
    if (cache) return cache;
    try {
        const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        const list = Array.isArray(raw) ? raw : (raw.monsters || []);
        cache = new Map();
        for (const m of list) {
            if (m && typeof m.name === 'string') cache.set(m.name.toLowerCase(), m);
        }
    } catch (e) {
        console.error('[ai:monsterActions] failed to load monsters.json:', e);
        cache = new Map();
    }
    return cache;
}

/** 'Goblin 1' → 'goblin'; 'Goblin' → 'goblin'; trailing instance digits only. */
export function baseName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+\d+$/, '');
}

/** Max numeric speed in ft. from a monster speed field ('30 ft.', {walk:'30 ft.'}). */
export function speedFeetOf(monster) {
    const speed = monster?.speed;
    const values = typeof speed === 'object' && speed !== null ? Object.values(speed) : [speed];
    const nums = values.map(v => parseInt(String(v), 10)).filter(n => Number.isFinite(n));
    return nums.length ? Math.max(...nums) : null;
}

/**
 * @returns {{ name, speedFeet, actions:[{name, description, attack_bonus}] }|null}
 */
export function lookupMonsterActions(name) {
    const idx = monsterIndex();
    const monster = idx.get(String(name || '').toLowerCase()) || idx.get(baseName(name));
    if (!monster) return null;
    return {
        name: monster.name,
        speedFeet: speedFeetOf(monster),
        actions: (monster.actions || []).map(a => ({
            name: a.name,
            description: String(a.description || '').slice(0, 300),
            attack_bonus: a.attack_bonus ?? null,
        })),
    };
}
