// @maintained-by-ai
// MA-1936 lane: King Kong legendary advisory row "Climbing Dash (Costs 2 Actions)"
// (#1086 real-row disk bytes; #1094 name-lookup). Silent-burn fixed by the flat
// advisory fields §253 movement-row template (MA-1581/MA-1450 family): advisory is
// inspected BEFORE the numeric/delegate legs (Modal :755), so delegates_to:null
// stays byte-unchanged — NEVER delegates_to:"Slam" (MA-1847 forces an un-optional
// full Slam) — and the press becomes an honest record-only popup + ability_use
// "GM-enforced" log while the costs-2 gate keeps spending 2.
//
// CITATION TABLE (this lane holds ONLY its row's copy bytes + inertness + one press):
//  - advisory detector / popup-chrome / log-shape / fallback-precedence generics:
//    CANON monsterActionAdvisory.test.js :60-117 — cited, not re-driven;
//  - MA-0058 legendary fallback pin: monsterLegendaryUses.test.js :607-618 — cited;
//  - turn-latch / own-turn / exhausted refusal vocabulary + legendary_use_refused
//    log shape: MA-0021 monsterLegendaryUses.test.js :79-110, :136-140, :164-167 —
//    gate refuse (turn→cost order) cited, not re-driven here;
//  - cost-2 grammar + insufficient-cost near-miss floor (#943): MA-1883 :195-215
//    (incl. it.each cost-2-vs-1 table) and ma1582 :131-152 — cited, deleted here;
//  - King Kong save core: monsterGrabSave.ma1931; Thunder Roar decoy shape:
//    monsterRecharge.ma1932 — different cards blocks, no overlap.
//
// old→new (#1038 leg table): old disk + no-numeric + card-siblings tests → one disk
// test (raw exact-once anchor #1086, §168 inert child folded, #948 decoys by NAME:
// Slam/Rock Throw legendary + Multiattack/Slam/Grab/Thunder Roar normal siblings
// byte-inert, Slam delegate + Rock Throw numerics pinned once as sole owner);
// old popup + old log tests → one INERT-record test (popup exact-toBe #1104 shape,
// zero roll fields #934, MA-0058 fallback-leak guard); old header-re-pin + press →
// lane-distinct "advisory press spends exactly 2" (refusals cited above);
// old turn-latch + cost-floor refuses DELETED (owners cited above).
// Disk-only asserts (#1057); no wall-clock, log description exact (#app); fixture
// test-local → no afterEach needed (#1007); dead imports purged (#1094/#1107).
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

const kingKong = monstersData.find((m) => m.index === 'king-kong');
// Name-lookup, not brittle index (#1094).
const dash = kingKong.legendary_actions.find((a) => a.name === 'Climbing Dash (Costs 2 Actions)');
const DASH_MESSAGE = "Kong moves up to his Speed without provoking Opportunity Attacks, climbing or swinging, and can make one Slam attack at any point along the path — GM-enforced movement; resolve any optional mid-path Slam as a separate Slam action (GM-enforced).";

describe('MA-1936 monsters.json disk bytes: King Kong Climbing Dash advisory stamp, exact-once', () => {
  it('row byte-locked: advisory + advisory_message after delegates_to:null, before description; raw anchor exact-once (#1086); §168 inert child; #948 siblings byte-inert (Slam delegate + Rock Throw numerics pinned once)', () => {
    expect(kingKong.name).toBe('King Kong');
    expect(dash).toBeDefined(); // guard the name-lookup branch (#1035)
    expect(Object.keys(dash)).toEqual(['name', 'delegates_to', 'advisory', 'advisory_message', 'description']);
    // delegates_to:null byte-unchanged — NEVER "Slam" (MA-1847 un-optional Slam).
    expect(dash.delegates_to).toBeNull();
    expect(dash.advisory).toBe('climbing_dash');
    expect(dash.advisory_message).toBe(DASH_MESSAGE);
    expect(dash.description).toBe("Kong moves up to his Speed without provoking Opportunity Attacks, climbing or swinging, and can make one Slam attack at any point along the path.");
    // Programmatic disk byte: fix appears exactly once in the file (#1086).
    const raw = readFileSync('public/data/monsters.json', 'utf8');
    expect(raw.split('"name": "Climbing Dash (Costs 2 Actions)",\n        "delegates_to": null,\n        "advisory": "climbing_dash",').length - 1).toBe(1);
    // Advisory child never rolls and never carries economy (§168 template,
    // MA-1847 axis closed): boundary economy only, no per-action cooldown clause.
    expect(dash.attack_bonus).toBeUndefined();
    expect(dash.save_dc).toBeUndefined();
    expect(dash.damage_dice_primary).toBeUndefined();
    expect(dash.uses).toBeUndefined();
    expect(hasLegendaryCooldownClause(dash)).toBe(false);
    // Closest-confusion decoys by NAME (#948): Climbing Dash is the ONLY
    // advisory row on the card; named siblings stay byte-inert — Slam keeps
    // its delegate, Rock Throw stays numeric, no advisory leak.
    expect(kingKong.legendary_actions.filter((a) => a.advisory).map((a) => a.name)).toEqual(['Climbing Dash (Costs 2 Actions)']);
    expect(Object.keys(kingKong.legendary_actions[0])).toEqual(['name', 'uses', 'description']);
    expect(kingKong.legendary_actions[1].delegates_to).toBe('Slam');
    expect(kingKong.legendary_actions[2].attack_bonus).toBe(17);
    expect(kingKong.legendary_actions[2].damage_dice_primary).toBe('3d10 + 10');
    for (const name of ['Multiattack', 'Slam', 'Grab', 'Thunder Roar (Recharge 5-6)']) {
      expect(kingKong.actions.find((a) => a.name === name).advisory).toBeUndefined();
    }
  });
});

describe('MA-1936 advisory Climbing Dash resolves to an INERT record — popup string + ability_use log, zero rolls', () => {
  it('predicate arms; popup exact-toBe with row copy beating MA-0058 fallback (#1104 shape); log is ability_use with zero roll fields (#934 — chrome cited CANON monsterActionAdvisory.test.js:60-117)', () => {
    expect(isMonsterActionAdvisoryRow(dash)).toBe(true);
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'King Kong 1', action: dash });
    expect(html).toBe(`<div class="mc-prerequisite-refusal"><h3>Legendary Action — Climbing Dash (Costs 2 Actions)</h3><p>King Kong 1 ${DASH_MESSAGE}</p></div>`);
    // MA-0058 fallback copy must NOT leak onto rows carrying advisory_message.
    expect(html).not.toContain('casts climbing dash on itself');
    const entry = buildLegendaryAdvisoryLog({ monsterName: 'King Kong 1', action: dash });
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('King Kong 1');
    expect(entry.abilityName).toBe('Climbing Dash (Costs 2 Actions)');
    expect(entry.description).toBe(`King Kong 1 legendary action Climbing Dash (Costs 2 Actions): King Kong 1 ${DASH_MESSAGE}`);
    // Advisory press never rolls.
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(entry.automationType).toBeUndefined();
  });
});

describe('MA-1936 costs-2 advisory press rides the shared gate — spends exactly 2, honest record-only', () => {
  it('legal-boundary press spends 3→1 once with exact spends-2 log (refusals cited MA-0021:79-140 + MA-1883:195-215)', async () => {
    const store = {};
    const logs = [];
    const deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Bandit 1' })),
    };
    const r = await expendLegendaryUse({ monsterName: 'King Kong 1', monster: kingKong, actionName: dash.name, action: dash, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 1, max: 3 });
    expect(store['King Kong 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toBe("King Kong 1 spends 2 legendary uses for Climbing Dash (Costs 2 Actions) after Bandit 1's turn — 1 of 3 left (regain at the start of King Kong 1's turn; 4 in lair advisory).");
  });
});
