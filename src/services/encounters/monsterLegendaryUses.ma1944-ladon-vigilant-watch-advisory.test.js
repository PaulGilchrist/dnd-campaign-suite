// @maintained-by-ai
// MA-1944 lane: Ladon legendary advisory row "Vigilant Watch (Costs 2 Actions)"
// (#829 exact-once anchor; #1094 name-lookup). Silent-burn (MA-0510 fingerprint: gated
// chip spent 2 while resolveLegendaryRowMechanic fell to the console.error dead-end,
// popup audit empty) fixed by the flat advisory fields §253 honest advisory-floor —
// MA-1936 King Kong byte-shape twin (same card lane, Modal :755 advisory inspected
// BEFORE the numeric/delegate legs), so delegates_to:null stays byte-unchanged
// (NEVER delegates_to a weapon — MA-1847 forces an un-optional full attack) and the
// press becomes an honest record-only popup + ability_use "GM-enforced" log while the
// costs-2 gate keeps spending 2 (LIVE, not residual).
//
// CITATION TABLE (this lane holds ONLY its row's copy bytes + inertness + one press):
//  - advisory detector / popup-chrome / log-shape / fallback-precedence generics:
//    CANON monsterActionAdvisory.test.js :60-117 — cited, not re-driven;
//  - MA-0058 legendary fallback pin: monsterLegendaryUses.test.js :607-618 — cited;
//  - turn-latch / own-turn / exhausted refusal vocabulary + legendary_use_refused
//    log shape: MA-0021 monsterLegendaryUses.test.js :79-110, :124-140, :164-167 —
//    gate refuse (turn→cost order) cited, not re-driven here;
//  - cost-2 grammar + insufficient-cost near-miss floor: MA-1883 :195-215
//    (incl. it.each cost-2-vs-1/cost-1-vs-0 table) — cited, deleted here (#1109);
//  - Ladon family axes: Constrict save core monsterHitConditions.ma1939; Sleeping
//    Mist recharge byte monsterRecharge.ma1940 — different axes, no overlap.
//
// old→new (#1038 leg table): old disk-identity + raw-numerics-substring + zero-numeric
// + no-reactions + card-siblings tests → ONE disk test (raw exact-once anchor #1086;
// substring test folded — exact toBe subsumes toContain; §168 inert child folded;
// reactions:[] honest-floor §70 folded; #948 decoys by NAME: Bite/Coil legendary
// delegates + Multiattack/Bite/Constrict/Sleeping Mist normal siblings byte-inert;
// header.uses pinned exactly ONCE — #1101 within-file dupe resolved);
// old popup + old log tests → ONE INERT-record test (popup exact-toBe #1104 shape,
// fallback-leak guard, zero roll fields #934 — chrome cited CANON :60-117);
// old header-re-pin DELETED (#1101: uses-echo + cost-2 grammar owned MA-1883:17-49,
// press below proves the spend); old turn-latch re-press DELETED (MA-0021 owners);
// old cost-floor-at-1-left + exhausted-at-0 refuses DELETED (#1109 verbatim:
// MA-1883:215 + MA-0021:99-132); old press KEPT lane-distinct (#829 spends-exactly-2).
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

const ladon = monstersData.find((m) => m.index === 'ladon');
// Name-lookup, not brittle index (#1094).
const watch = ladon.legendary_actions.find((a) => a.name === 'Vigilant Watch (Costs 2 Actions)');
const WATCH_MESSAGE = "Ladon fixes one target. Until the start of his next turn, his next Opportunity Attack against that target has +5 to hit — GM-enforced; no fixed-target or monster Opportunity Attack consumer exists in the app.";

describe('MA-1944 monsters.json disk bytes: Ladon Vigilant Watch advisory stamp, exact-once', () => {
  it('row byte-locked: advisory + advisory_message after delegates_to:null, before description; raw anchor exact-once (#1086); §168 inert child; §70 no-OA-surface honest floor; #948 siblings byte-inert (Bite/Coil delegates + header uses:3 pinned once — #1101)', () => {
    expect(ladon.name).toBe('Ladon');
    expect(watch).toBeDefined(); // guard the name-lookup branch (#1035)
    expect(Object.keys(watch)).toEqual(['name', 'delegates_to', 'advisory', 'advisory_message', 'description']);
    // delegates_to:null byte-unchanged — NEVER a weapon delegate (MA-1847).
    expect(watch.delegates_to).toBeNull();
    expect(watch.advisory).toBe('vigilant_watch');
    // Exact bytes carry the RAW numerics honestly (+5-to-hit, fix-target, GM-enforced
    // residual) — old substring test folded (exact toBe subsumes toContain).
    expect(watch.advisory_message).toBe(WATCH_MESSAGE);
    expect(watch.description).toBe("Ladon fixes one target. Until the start of his next turn, his next Opportunity Attack against that target has +5 to hit.");
    // Programmatic disk byte: fix appears exactly once in the file (#1086 / #829).
    const raw = readFileSync('public/data/monsters.json', 'utf8');
    expect(raw.split('"name": "Vigilant Watch (Costs 2 Actions)",\n        "delegates_to": null,\n        "advisory": "vigilant_watch",').length - 1).toBe(1);
    // Advisory child never rolls and never carries economy (§168 template,
    // MA-1847 axis closed): boundary economy only, no per-action cooldown clause.
    expect(watch.attack_bonus).toBeUndefined();
    expect(watch.save_dc).toBeUndefined();
    expect(watch.damage_dice_primary).toBeUndefined();
    expect(watch.uses).toBeUndefined();
    expect(hasLegendaryCooldownClause(watch)).toBe(false);
    // Ladon has no monster-side Opportunity Attack surface — advisory is the
    // honest floor (§70); OA machinery is PC-side only.
    expect(ladon.reactions).toEqual([]);
    // Closest-confusion decoys by NAME (#948): Vigilant Watch is the ONLY
    // advisory row on the card; Bite/Coil keep their delegates byte-inert,
    // header uses:3 pinned exactly ONCE here (#1101), normal siblings no leak
    // (Sleeping Mist bytes owned by monsterRecharge.ma1940 — not re-pinned).
    expect(ladon.legendary_actions.filter((a) => a.advisory).map((a) => a.name)).toEqual(['Vigilant Watch (Costs 2 Actions)']);
    const header = ladon.legendary_actions[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.uses).toBe(3);
    expect(ladon.legendary_actions[1].delegates_to).toBe('Bite');
    expect(ladon.legendary_actions[1].advisory).toBeUndefined();
    expect(ladon.legendary_actions[2].delegates_to).toBe('Constrict');
    expect(ladon.legendary_actions[2].advisory).toBeUndefined();
    for (const name of ['Multiattack', 'Bite', 'Constrict', 'Sleeping Mist (Recharge 5-6)']) {
      expect(ladon.actions.find((a) => a.name === name).advisory).toBeUndefined();
    }
  });
});

describe('MA-1944 advisory Vigilant Watch resolves to an INERT record — popup string + ability_use log, zero rolls', () => {
  it('predicate arms; popup exact-toBe with row copy beating MA-0058 fallback (#1104 shape); log is ability_use with zero roll fields (#934 — chrome cited CANON monsterActionAdvisory.test.js:60-117)', () => {
    expect(isMonsterActionAdvisoryRow(watch)).toBe(true);
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'Ladon 1', action: watch });
    expect(html).toBe(`<div class="mc-prerequisite-refusal"><h3>Legendary Action — Vigilant Watch (Costs 2 Actions)</h3><p>Ladon 1 ${WATCH_MESSAGE}</p></div>`);
    // MA-0058 fallback copy must NOT leak onto rows carrying advisory_message.
    expect(html).not.toContain('casts vigilant watch on itself');
    const entry = buildLegendaryAdvisoryLog({ monsterName: 'Ladon 1', action: watch });
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Ladon 1');
    expect(entry.abilityName).toBe('Vigilant Watch (Costs 2 Actions)');
    expect(entry.description).toBe(`Ladon 1 legendary action Vigilant Watch (Costs 2 Actions): Ladon 1 ${WATCH_MESSAGE}`);
    // Advisory press never rolls.
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(entry.automationType).toBeUndefined();
  });
});

describe('MA-1944 costs-2 advisory press rides the shared gate — spends exactly 2, honest record-only', () => {
  it('legal-boundary press spends 3→1 once with exact spends-2 log (refusals cited MA-0021:79-140 + MA-1883:195-215)', async () => {
    const store = {};
    const logs = [];
    const deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Bandit 1' })),
    };
    const r = await expendLegendaryUse({ monsterName: 'Ladon 1', monster: ladon, actionName: watch.name, action: watch, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 1, max: 3 });
    expect(store['Ladon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toBe("Ladon 1 spends 2 legendary uses for Vigilant Watch (Costs 2 Actions) after Bandit 1's turn — 1 of 3 left (regain at the start of Ladon 1's turn; 4 in lair advisory).");
  });
});
