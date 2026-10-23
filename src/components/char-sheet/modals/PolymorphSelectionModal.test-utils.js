// ---------------------------------------------------------------------------
// PolymorphSelectionModal Test Utilities — shared fixtures for BOTH test
// lanes of PolymorphSelectionModal (PolymorphSelectionModal.test.jsx core
// lane and PolymorphSelectionModal.features.test.jsx features lane).
// ---------------------------------------------------------------------------
// Extracted from the previously duplicated lane fixtures (ledger pass #150
// rec: "mockMonsters copy-pasted from features lane (drifted); extract
// shared fixture module"). The historical drift (hand-copied numeric speeds
// instead of the disk's "40 ft." strings) is closed: every shared row here
// is a REAL disk row from public/data/monsters.json, quoted-by-name and
// pinned with drift-throws. Lane-distinctive rows (core: Panther/Brown
// Bear/Badger; features: Adult Black Dragon) and lane-distinctive
// limitation-verification strategies stay LOCAL in each lane — honest split,
// no forced unification.

import { readFileSync } from 'node:fs';

const diskMonsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));

// BY-name disk lookup with drift-throw so a renamed/removed row fails loudly
// at fixture load, not as a confusing selector miss inside a test.
export function diskMonster(name) {
    const found = diskMonsters.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!found) throw new Error(`Fixture drift: '${name}' no longer exists in public/data/monsters.json`);
    return found;
}

// Monster rows both lanes consume, straight from disk bytes.
export const WOLF = diskMonster('Wolf');
export const CROCODILE = diskMonster('Crocodile');
export const EAGLE = diskMonster('Eagle');
export const RAT = diskMonster('Rat');
export const GIANT_SPIDER = diskMonster('Giant Spider');
export const GHAST = diskMonster('Ghast');

// Exact disk bytes the shared assertions depend on (speed/cr/type), quoted
// from public/data/monsters.json on 2026-10-23. Note Eagle's lowercase
// 'beast' type is disk-faithful, not a typo. Each lane pins its own extra
// rows via assertDiskRows with a lane-local pin map.
export const SHARED_MONSTER_PINS = {
    wolf: { speed: { walk: '40 ft.' }, challenge_rating: '0.25', type: 'Beast' },
    crocodile: { speed: { walk: '20 ft.', swim: '30 ft.' }, challenge_rating: '0.5', type: 'Beast' },
    eagle: { speed: { walk: '10 ft.', fly: '60 ft.' }, challenge_rating: '0', type: 'beast' },
    rat: { speed: { walk: '20 ft.', fly: '', swim: '', climb: '20 ft.', burrow: '', other: [] }, challenge_rating: '0', type: 'Beast' },
    'giant spider': { speed: { walk: '30 ft.', climb: '30 ft.' }, challenge_rating: '1', type: 'Beast' },
    ghast: { speed: { walk: '30 ft.' }, challenge_rating: '2', type: 'Undead' },
};

// Drift-throw pin checker: fails at fixture-load time if disk bytes change
// underneath an assertion's literal.
export function assertDiskRows(pins) {
    for (const [name, expected] of Object.entries(pins)) {
        const m = diskMonster(name);
        if (JSON.stringify(m.speed) !== JSON.stringify(expected.speed)
            || String(m.challenge_rating) !== expected.challenge_rating
            || m.type !== expected.type) {
            throw new Error(`Fixture drift: '${name}' disk row changed - ${JSON.stringify(m)} (expected speed ${JSON.stringify(expected.speed)}, cr ${expected.challenge_rating}, type ${expected.type})`);
        }
    }
}

// Limitation prose vocabulary emitted by classRules.getDruidFeatures /
// classRules2024.getDruidFeatures (classRules.js:124-128; classRules2024.js:293):
// the clause before "only" enumerates ALLOWED modes, "(no ...)" enumerates
// FORBIDDEN ones — 'walk only (no swim or fly)' must NOT surface
// swim/climb/burrow (pass #150 polarity defect, fixed 2f8963d45).
export const WALK_ONLY = 'walk only (no swim or fly)';
export const WALK_OR_SWIM = 'walk or swim only (no fly)';
export const WALK_SWIM_FLY = 'walk, swim, or fly';

// Beast-row DOM helpers shared by both lanes.
export function findBeastItem(beastName) {
    return Array.from(document.querySelectorAll('.wild-shape-beast-item')).find(item =>
        item.querySelector('.wild-shape-beast-name').textContent.includes(beastName)) || null;
}

export function speedTextOf(beastName) {
    const item = findBeastItem(beastName);
    if (!item) throw new Error(`Beast row missing: ${beastName}`);
    const spans = item.querySelectorAll('.wild-shape-beast-stats span');
    return spans[spans.length - 1].textContent;
}
