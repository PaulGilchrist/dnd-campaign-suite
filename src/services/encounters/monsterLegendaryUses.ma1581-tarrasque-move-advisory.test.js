// @maintained-by-ai
// MA-1581: Tarrasque legendary "Move" was plain text with zero affordance
// (FAIL(b)/DATA). Fix = advisory child stamp {advisory:"movement",
// advisory_message} after name, before description — the §MA-1456 /
// MA-0957 byte-twin of the MA-0058/0270/0271 legendary advisory seam: the
// row keeps riding the single gated "Expend Legendary" chip (MA-0021
// economy — cited, never re-added), the spend is adjudicated by the shared
// gate, then resolveLegendaryRowMechanic's advisory leg (MonsterCardModal
// advisory-before-numeric order §MA-1457; modal-leg consumers drive that
// lane, e.g. MonsterCardModal.ma1975) lands an honest adjudication record
// (popup + ability_use log) instead of a console.error dead-end.
// Movement-distance (half of walk 40 ft. = 20 ft.) stays GM-enforced: no
// movement-distance consumer app-wide (§70), token-drag residual by design.
//
// OWNERSHIP / CITATIONS (#1102 4-lane table @ma1579 header — ma1581 =
// THIS lane = Move advisory row only):
//  - header uses:3 + typo-fix bytes + full pool-walk/refusal/regain
//    economy vocabulary (incl. press('Move') same-boundary 'turn' refusal):
//    ma1579 :39 + :86 — cited, not re-driven here;
//  - legendaryExpendGate fingerprint table (turn/exhausted/own-turn):
//    MA-0021 generic monsterLegendaryUses.test.js :79-110 — cited
//    (transitive twin deleted per ma1579 header note);
//  - Attack→Claw delegate bytes/seam: ma1580 :52-77 · Chomp→Bite cost-2:
//    ma1582 :43-56 (+ siblings pin :81-95 citing this row) — deleted here;
//  - advisory builder chrome + fallback-copy generics: CANON
//    monsterActionAdvisory.test.js :81-117 (normal-action twin) and the
//    MA-0058 legendary fallback pin monsterLegendaryUses.test.js :607-618 —
//    this lane holds ONLY its row's honest copy bytes + inertness face.
//
// old→new (#1038 leg table): old data byte + no-numeric + decoy tests →
// one disk test (name-lookup #1094, raw exact-once anchor #1086, §168
// child template folded, advisory-exact-once vs Bite/Tail/Swallow name
// decoys #948); old popup + old log tests → one inert-record test (zero
// roll fields #934, fallback-leak guard); old header-re-pin press →
// lane-distinct "Move advisory spends exactly 1" press (header bytes
// byte-cited to ma1579); old turn-latch refuse deleted (ma1579 :86 drives
// press('Move') → 'turn'; MA-0021 :136); old pool-walk + gate-fingerprint
// deleted (rec #1102 — owners above); old Attack+Chomp bytes deleted
// (rec #1103 — owners above); androsphinx + arch-hag byte-twin tests
// folded into one table test (coverage preserved, count halved).
// Disk-only asserts (#1057); no wall-clock (#app — log timestamps never
// checked); fixtures test-local → no afterEach needed (#1007).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  expendLegendaryUse,
  buildLegendaryAdvisoryPopup,
  buildLegendaryAdvisoryLog,
  hasLegendaryCooldownClause,
} from './monsterLegendaryUses.js';
import { isMonsterActionAdvisoryRow } from './monsterActionAdvisory.js';
import monstersData from '../../../public/data/monsters.json';

// Transitive import guard (storage persists via fetch in sibling seams).
vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const tarrasque = monstersData.find(m => m.index === 'tarrasque');
// Name-lookup, not brittle index (#1094).
const move = tarrasque.legendary_actions.find(a => a.name === 'Move');
const MOVE_MESSAGE = 'moves up to half its speed (40 ft.) — advisory record: GM moves the token; no movement-distance consumer (MA-1581). Movement-distance is GM-enforced and the spend is already adjudicated by the legendary gate.';

describe('MA-1581 monsters.json disk bytes: Tarrasque "Move" advisory stamp, exact-once', () => {
  it('Move row byte-locked + raw anchor exact-once (#1086); §168 inert child; advisory stamped exact-once vs Bite/Tail/Swallow decoys (#948)', () => {
    expect(move.advisory).toBe('movement');
    expect(move.advisory_message).toBe(MOVE_MESSAGE);
    expect(move.description).toBe('The tarrasque moves up to half its speed.');
    expect(Object.keys(move)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    // Programmatic disk byte: fix appears exactly once in the file (#1086).
    const raw = readFileSync('public/data/monsters.json', 'utf8');
    expect(raw.split('"name": "Move",\n        "advisory": "movement",').length - 1).toBe(1);
    // Advisory child never rolls and never carries economy (§168 template):
    // boundary economy only — no per-action cooldown clause on this row.
    expect(move.attack_bonus).toBeUndefined();
    expect(move.save_dc).toBeUndefined();
    expect(move.damage_dice_primary).toBeUndefined();
    expect(move.delegates_to).toBeUndefined();
    expect(move.uses).toBeUndefined();
    expect(hasLegendaryCooldownClause(move)).toBe(false);
    // Closest-confusion decoys: Move is the ONLY advisory row in the block;
    // the sibling normal attacks share no advisory stamp by name.
    expect(tarrasque.legendary_actions.filter(a => a.advisory).map(a => a.name)).toEqual(['Move']);
    for (const name of ['Bite', 'Tail', 'Swallow']) {
      expect(tarrasque.actions.find(a => a.name === name).advisory).toBeUndefined();
    }
  });
});

describe('MA-1581 advisory Move resolves to an INERT record — popup string + ability_use log, zero rolls', () => {
  it('predicate arms; popup carries the row copy with MA-0058 fallback-leak guard; log is ability_use with zero roll fields (#934 — chrome cited monsterActionAdvisory.test.js:81-117, monsterLegendaryUses.test.js:607)', () => {
    expect(isMonsterActionAdvisoryRow(move)).toBe(true);
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'Tarrasque 1', action: move });
    expect(html).toBe(`<div class="mc-prerequisite-refusal"><h3>Legendary Action — Move</h3><p>Tarrasque 1 ${MOVE_MESSAGE}</p></div>`);
    // MA-0058 fallback copy must NOT leak onto rows carrying advisory_message.
    expect(html).not.toContain('casts movement on itself');
    const entry = buildLegendaryAdvisoryLog({ monsterName: 'Tarrasque 1', action: move });
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Tarrasque 1');
    expect(entry.abilityName).toBe('Move');
    expect(entry.description).toBe(`Tarrasque 1 legendary action Move: Tarrasque 1 ${MOVE_MESSAGE}`);
    // Advisory press never rolls.
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(entry.automationType).toBeUndefined();
  });
});

describe('MA-1581 Move advisory rides the shared gate — legal press spends exactly 1', () => {
  it('legal-boundary press of the advisory row spends 3→2 once (header uses:3 byte-locked @ma1579:39; refusals/regain vocabulary cited MA-0021:79-136 + ma1579:86 which presses Move itself)', async () => {
    const store = {};
    const logs = [];
    const deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Bandit 1' })),
    };
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Move', action: move, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(logs.some(e => e.type === 'ability_use' && /expends a legendary use for Move .* 2 of 3 left/.test(e.description))).toBe(true);
  });
});

describe('MA-1581 cited byte-twins intact (folded — coverage preserved, count halved)', () => {
  it.each([
    ['androsphinx', 'Teleport (Costs 2 Actions)', 'sphinx_teleport', ['no position consumer (CLA-320)', 'MA-1883 per-row cost parsing spends 2 per press'], false],
    ['arch-hag', 'Malicious Magic', 'malicious_magic', ['GM adjudicates spell choice'], true],
  ])('%s %s: advisory + advisory_message child-shape twin + uses:3 header intact', (index, name, advisory, fragments, hasCooldown) => {
    const monster = monstersData.find(m => m.index === index);
    expect(monster.legendary_actions[0].uses).toBe(3);
    const row = monster.legendary_actions.find(a => a.name === name);
    expect(Object.keys(row)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(row.advisory).toBe(advisory);
    for (const frag of fragments) {
      expect(row.advisory_message).toContain(frag);
    }
    expect(hasLegendaryCooldownClause(row)).toBe(hasCooldown);
  });
});
