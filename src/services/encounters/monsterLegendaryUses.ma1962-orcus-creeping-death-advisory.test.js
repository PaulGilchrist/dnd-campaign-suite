// @maintained-by-ai
// MA-1962 lane: Orcus legendary advisory row "Creeping Death (Costs 2 Actions)"
// (#829 exact-once anchor; #1094 name-lookup). Silent-burn (MA-0510 fingerprint: gated
// chip spent 2 while resolveLegendaryRowMechanic fell to the console.error dead-end,
// popups[] empty, no zone/vulnerability record) fixed by the flat advisory fields §253
// honest advisory-floor — MA-1936 King Kong / MA-1944 Ladon byte-shape twins (Modal
// :755 advisory inspected BEFORE the numeric/delegate legs). This child NEVER carried
// delegates_to (unlike the twins' delegates_to:null) — the fix MUST NOT add one
// (MA-1847 axis), so the row keys stay [name, advisory, advisory_message, description].
// The press becomes an honest record-only popup + ability_use "GM-enforced" advisory log
// while the costs-2 gate keeps spending 2 honestly (LIVE, not residual) and the MA-0510
// console error dies. No necrotic-vulnerability te, no zone dict, no ticks —
// GM-positioned cylinder = codified advisory floor (MA-1060 Kraken family; §70 zone/wall
// zero-consumer).
//
// CITATION TABLE (this lane holds ONLY its row's copy bytes + inertness + one press):
//  - advisory detector / popup-chrome / log-shape / fallback-precedence generics:
//    CANON monsterActionAdvisory.test.js :60-117 — cited, not re-driven;
//  - MA-0058 legendary fallback pin ("...on itself via Spellcasting" copy):
//    monsterLegendaryUses.test.js :607-618 — cited; leak-guard below only;
//  - turn-latch / own-turn / exhausted refusal vocabulary + legendary_use_refused
//    log shape: MA-0021 monsterLegendaryUses.test.js :79-110, :124-140, :164-167 —
//    gate refuse (turn→cost order) cited, not re-driven here;
//  - cost-2 grammar + insufficient-cost near-miss floor: MA-1883 :17-49, :195-215
//    (incl. it.each cost-2-vs-1/cost-1-vs-0 table) — cited, deleted here (#1109 rec,
//    4th lane closing the verbatim refusals);
//  - epic cohort orcus AC 17 / HP 405 band + engine seams + card parity:
//    monsterEpicCohort.test.js :30, :52, :59-132 — cited, not re-driven;
//  - MA-1958 Orcus Spellcasting row bytes/chips: MonsterCardModal.ma1958-orcus-spellcasting.test.jsx :154-190;
//  - MA-1959 Wand Spellcasting bytes/chip+shell fork: MonsterCardModal.ma1959-orcus-wand-spellcasting.test.jsx :176-181, :222-300 —
//    old card-siblings tests here deleted, owners verified live;
//  - Conjure Undead summon lane: monsterSummon.orcus-conjure-undead.test.js — different axis.
//
// old→new (#1038 leg table): old disk-identity + raw-numerics-substring + zero-numeric
// + no-reactions/lair + card-siblings tests → ONE disk test (raw exact-once anchor #1086;
// substring test folded — exact toBe subsumes toContain on both message AND description
// bytes; §168 inert child folded; §70 reactions:[]/lair_actions:[] honest floor folded;
// #948 decoys by NAME: Attack→Necrotic Bolt delegate stays numeric, Wand of Orcus/Tail/
// Multiattack/Conjure Undead normal siblings byte-inert; header.uses pinned exactly ONCE
// — #1101 within-file dupe resolved); old popup + old log tests → ONE INERT-record test
// (popup exact-toBe #1104 shape, MA-0058 fallback-leak guard, zero roll fields #934 —
// chrome cited CANON :60-117); old header-re-pin DELETED (#1101: uses-echo + cost-2
// grammar owned MA-1883:17-49, press below proves the spend); old turn-latch re-press
// DELETED (MA-0021 owners); old cost-floor-at-1-left + exhausted-at-0 refuses DELETED
// (carried rec #1109 verbatim :137-147: MA-1883:215 + MA-0021:99-132 owners verified
// live); old MA-1958/MA-1959 sibling-row tests DELETED (owners live in modal tests).
// Disk-only asserts (#1057); no wall-clock, log description exact (#app); fixture
// test-local → no afterEach needed (#1007); dead imports purged (#1094 class).
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

const orcus = monstersData.find((m) => m.index === 'orcus');
// Name-lookup, not brittle index (#1094).
const death = orcus.legendary_actions.find((a) => a.name === 'Creeping Death (Costs 2 Actions)');
const DEATH_MESSAGE = "Area Effect: a 60-foot-tall, 10-foot-radius Cylinder of swirling necrotic energy rises from a point Orcus can see within 100 ft. and lasts until the end of his next turn. Creatures in the area have Vulnerability to Necrotic damage — GM-enforced; no cylinder-zone or vulnerability consumer exists in the app. No saving throw, no damage.";

describe('MA-1962 monsters.json disk bytes: Orcus Creeping Death advisory stamp, exact-once', () => {
  it('row byte-locked: advisory + advisory_message after name, before description, NO delegates_to ever; raw anchor exact-once (#1086); §168 inert child; §70 no-zone-surface honest floor; #948 siblings byte-inert (Attack→Necrotic Bolt numeric + header uses:3 pinned once — #1101)', () => {
    expect(orcus.name).toBe('Orcus');
    expect(death).toBeDefined(); // guard the name-lookup branch (#1035)
    expect(Object.keys(death)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    // Disk-canonical: this child NEVER carried delegates_to (unlike sibling
    // "Attack" → Necrotic Bolt) — the fix MUST NOT add one (MA-1847 axis).
    expect(death.delegates_to).toBeUndefined();
    expect(death.advisory).toBe('creeping_death');
    // Exact bytes carry the RAW numerics honestly (cylinder dims + range +
    // duration + vulnerability + GM-enforced residual) — old substring test
    // folded (exact toBe subsumes toContain).
    expect(death.advisory_message).toBe(DEATH_MESSAGE);
    // Row description is the UNSANITIZED prose twin — byte-distinct from the
    // advisory_message (it can see / Orcus's turn, no GM-enforced clause).
    expect(death.description).toBe("Area Effect: a 60-foot-tall, 10-foot-radius Cylinder of swirling necrotic energy rises from a point it can see within 100 ft. and lasts until the end of Orcus's next turn. Creatures in the area have Vulnerability to Necrotic damage. No saving throw, no damage.");
    // Programmatic disk byte: fix appears exactly once in the file (#1086 / #829).
    const raw = readFileSync('public/data/monsters.json', 'utf8');
    expect(raw.split('"name": "Creeping Death (Costs 2 Actions)",\n        "advisory": "creeping_death",').length - 1).toBe(1);
    // Advisory child never rolls and never carries economy (§168 template,
    // MA-1847 axis closed): boundary economy only, no zone, no cooldown clause.
    expect(death.attack_bonus).toBeUndefined();
    expect(death.save_dc).toBeUndefined();
    expect(death.damage_dice_primary).toBeUndefined();
    expect(death.uses).toBeUndefined();
    expect(death.zone).toBeUndefined();
    expect(hasLegendaryCooldownClause(death)).toBe(false);
    // Orcus has no monster-side zone/lair surface — advisory is the honest
    // floor (§70, MA-1060 family); GM-positioned cylinder never auto-builds.
    expect(orcus.reactions).toEqual([]);
    expect(orcus.lair_actions).toEqual([]);
    // Closest-confusion decoys by NAME (#948): Creeping Death is the ONLY
    // advisory row on the card; Attack keeps its Necrotic Bolt delegate
    // byte-inert (delegate master stays numeric), header uses:3 pinned
    // exactly ONCE here (#1101), normal siblings no leak.
    expect(orcus.legendary_actions.filter((a) => a.advisory).map((a) => a.name)).toEqual(['Creeping Death (Costs 2 Actions)']);
    const header = orcus.legendary_actions[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.uses).toBe(3);
    expect(orcus.legendary_actions[1].delegates_to).toBe('Necrotic Bolt');
    expect(orcus.legendary_actions[1].advisory).toBeUndefined();
    const bolt = orcus.actions.find((a) => a.name === 'Necrotic Bolt');
    expect(bolt.advisory).toBeUndefined();
    expect(bolt.damage_dice_primary).toBe('5d8 + 7');
    expect(bolt.damage_type_primary).toBe('Necrotic');
    for (const name of ['Multiattack', 'Wand of Orcus', 'Tail', 'Conjure Undead (1/Day)']) {
      expect(orcus.actions.find((a) => a.name === name).advisory).toBeUndefined();
    }
  });
});

describe('MA-1962 advisory Creeping Death resolves to an INERT record — popup string + ability_use log, zero rolls', () => {
  it('predicate arms; popup exact-toBe with row copy beating MA-0058 fallback (#1104 shape); log is ability_use with zero roll fields (#934 — chrome cited CANON monsterActionAdvisory.test.js:60-117)', () => {
    expect(isMonsterActionAdvisoryRow(death)).toBe(true);
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'Orcus 1', action: death });
    expect(html).toBe(`<div class="mc-prerequisite-refusal"><h3>Legendary Action — Creeping Death (Costs 2 Actions)</h3><p>Orcus 1 ${DEATH_MESSAGE}</p></div>`);
    // MA-0058 invisibility fallback copy must NOT leak onto rows carrying advisory_message.
    expect(html).not.toContain('on itself via Spellcasting');
    const entry = buildLegendaryAdvisoryLog({ monsterName: 'Orcus 1', action: death });
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Orcus 1');
    expect(entry.abilityName).toBe('Creeping Death (Costs 2 Actions)');
    expect(entry.description).toBe(`Orcus 1 legendary action Creeping Death (Costs 2 Actions): Orcus 1 ${DEATH_MESSAGE}`);
    // Advisory press never rolls.
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(entry.automationType).toBeUndefined();
  });
});

describe('MA-1962 costs-2 advisory press rides the shared gate — spends exactly 2, honest record-only', () => {
  it('legal-boundary press spends 3→1 once with exact spends-2 log (refusals cited MA-0021:79-140 + MA-1883:195-215)', async () => {
    const store = {};
    const logs = [];
    const deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Bandit 1' })),
    };
    const r = await expendLegendaryUse({ monsterName: 'Orcus 1', monster: orcus, actionName: death.name, action: death, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 1, max: 3 });
    expect(store['Orcus 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toBe("Orcus 1 spends 2 legendary uses for Creeping Death (Costs 2 Actions) after Bandit 1's turn — 1 of 3 left (regain at the start of Orcus 1's turn; 4 in lair advisory).");
  });
});
