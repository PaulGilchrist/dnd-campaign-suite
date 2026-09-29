// MA-1582: Tarrasque legendary_actions[3] "Chomp (Costs 2 Actions)" was
// plain text with zero affordance (FAIL(b)/DATA) — the "(Costs 2 Actions)"
// suffix rendered fully and honestly but is inert label text: no consumer
// parses costs anywhere in the legendary-uses engine. Fix = one DATA field
// `delegates_to:"Bite"` after name, before description — the MA-0375
// beholder Chomp→Bite / MA-1580 Tarrasque Attack→Claw byte-twins riding
// the MA-0022 delegate seam (legendaryDelegateAction spans actions +
// legendary_actions; resolveLegendaryRow resolves the REAL Bite row —
// +19 / 4d12 + 10 Piercing, MA-1573 typo-fix byte — through the identical
// attack seam AFTER the shared MA-0021 spend gate; header uses:3 MA-1579
// and Attack delegate MA-1580, Move advisory MA-1581 all verified on disk,
// never re-added).
//
// DOCUMENTED ACCEPTED RESIDUALS (no code, this comment only):
// (1) COST-2 UNENFORCED: RAW Chomp costs 2 legendary actions; the engine
//     has no cost parser (grep: zero "cost" consumers in
//     monsterLegendaryUses.js) and spends 1 per click via the shared gate.
//     The gate's one-expend-per-boundary latch at least halves the abuse
//     surface; the second-uses deduction stays GM-adjudicated.
// (2) SWALLOW SECOND OPTION UNEXPRESSIBLE: "…or uses its Swallow" cannot be
//     offered on the single-delegate model — delegates_to names exactly one
//     row; the Bite-or-Swallow choice stays GM-adjudicated prose.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  legendaryHeaderAction,
  legendaryDelegateAction,
  legendaryDelegateAttackName,
  expendLegendaryUse,
} from './monsterLegendaryUses.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const tarrasque = monstersData.find(m => m.index === 'tarrasque');
const chomp = tarrasque.legendary_actions[3];
const bite = tarrasque.actions.find(a => a.name === 'Bite');

describe('MA-1582 monsters.json data: Tarrasque legendary "Chomp (Costs 2 Actions)" delegates_to Bite', () => {
  it('legendary_actions[3] carries delegates_to "Bite" at the MA-1580 sibling byte position', () => {
    expect(chomp.name).toBe('Chomp (Costs 2 Actions)');
    expect(chomp.delegates_to).toBe('Bite');
    // key placement mirrors MA-1580 sibling (Attack) and MA-0375 beholder:
    // name → delegates_to → description.
    expect(Object.keys(chomp)).toEqual(['name', 'delegates_to', 'description']);
    expect(chomp.description).toBe('The tarrasque makes one bite attack or uses its Swallow.');
    // §168 child template: the row never rolls — no own numeric fields.
    expect(chomp.attack_bonus).toBeUndefined();
    expect(chomp.save_dc).toBeUndefined();
    expect(chomp.damage_dice_primary).toBeUndefined();
    expect(chomp.advisory).toBeUndefined();
    expect(chomp.uses).toBeUndefined();
  });

  it('raw-file anchor: chomp-unique byte appears exactly once in monsters.json', () => {
    const raw = fs.readFileSync(path.resolve(__dirname, '../../../public/data/monsters.json'), 'utf8');
    expect(raw.split('"name": "Chomp (Costs 2 Actions)",\n        "delegates_to": "Bite",').length - 1).toBe(1);
    expect(JSON.parse(raw).find(m => m.index === 'tarrasque').legendary_actions[3].delegates_to).toBe('Bite');
  });

  it('delegate spans actions[]: legendaryDelegateAction lands the REAL Bite attack row (+19 / 4d12 + 10 Piercing)', () => {
    const delegate = legendaryDelegateAction(tarrasque, chomp);
    expect(delegate).toBe(bite);
    expect(bite.attack_bonus).toBe(19);
    expect(bite.reach).toBe('10 ft.');
    expect(bite.damage_dice_primary).toBe('4d12 + 10');
    expect(bite.damage_type_primary).toBe('Piercing'); // MA-1573 capital-P disk byte
    expect(bite.hit_conditions).toEqual(['grappled', 'restrained']);
    // self-delegation guard: Bite itself never delegates
    expect(legendaryDelegateAction(tarrasque, bite)).toBeNull();
  });

  it('delegate chip label: "(Costs 2 Actions)" suffix display-intact + "(Bite attack)" — attack seam', () => {
    const delegate = legendaryDelegateAction(tarrasque, chomp);
    expect(legendaryDelegateAttackName(chomp, delegate)).toBe('Chomp (Costs 2 Actions) (Bite attack)');
  });

  it('siblings byte-locked: header uses:3 (MA-1579), Attack→Claw delegate (MA-1580), Move advisory (MA-1581) — verified, not re-added', () => {
    const la = tarrasque.legendary_actions;
    expect(la.map(a => a.name)).toEqual(['General', 'Attack', 'Move', 'Chomp (Costs 2 Actions)']);
    const header = la[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.uses).toBe(3);
    expect(legendaryHeaderAction(tarrasque)).toBe(header);
    const attack = la[1];
    expect(Object.keys(attack)).toEqual(['name', 'delegates_to', 'description']);
    expect(attack.delegates_to).toBe('Claw');
    const move = la[2];
    expect(Object.keys(move)).toEqual(['name', 'advisory', 'advisory_message', 'description']);
    expect(move.advisory).toBe('movement');
  });
});

describe('MA-1582 delegated Chomp rides the shared spend gate honestly (cost-2 residual recorded)', () => {
  let store;
  let logs;
  let deps;
  let cs;
  beforeEach(() => {
    store = {};
    logs = [];
    cs = { round: 1, activeCreatureName: 'Bandit 1' };
    deps = {
      getRuntimeValue: (name, key) => store[`${name}.${key}`] ?? null,
      setRuntimeValue: vi.fn((name, key, value) => { store[`${name}.${key}`] = value; return Promise.resolve(); }),
      addEntry: vi.fn((_c, entry) => { logs.push(entry); return Promise.resolve(); }),
      getCombatContext: vi.fn(() => Promise.resolve(cs)),
    };
  });

  it('end-of-other-turn press spends 3→2 with the Chomp name in the spend log', async () => {
    const delegate = legendaryDelegateAction(tarrasque, chomp);
    const actionName = legendaryDelegateAttackName(chomp, delegate);
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName, action: chomp, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 2, max: 3 });
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const spend = logs.filter(e => e.type === 'ability_use');
    expect(spend[0].description).toMatch(/expends a legendary use for Chomp \(Costs 2 Actions\) \(Bite attack\) .* 2 of 3 left/);
    // RESIDUAL (documented, honest): RAW cost is 2 — engine spends 1 per
    // click (no cost-2 consumer app-wide); the deduction of the second use
    // stays GM-adjudicated. One spend is asserted AS OBSERVED, not fudged.
  });

  it('own-turn press refuses own-turn with ZERO spend (gate turn-latch honest)', async () => {
    cs.activeCreatureName = 'Tarrasque 1';
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Chomp (Costs 2 Actions) (Bite attack)', action: chomp, campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('own-turn');
    expect(store['Tarrasque 1.monsterLegendaryUses']).toBeUndefined();
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);
  });

  it('exhausted press refuses exhausted with ZERO spend', async () => {
    store['Tarrasque 1.monsterLegendaryUses'] = { max: 3, used: 3 };
    const r = await expendLegendaryUse({ monsterName: 'Tarrasque 1', monster: tarrasque, actionName: 'Chomp (Costs 2 Actions) (Bite attack)', action: chomp, campaignName: 'test-campaign', deps });
    expect(r.spent).toBe(false);
    expect(r.reason).toBe('exhausted');
    expect(store['Tarrasque 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
  });
});
