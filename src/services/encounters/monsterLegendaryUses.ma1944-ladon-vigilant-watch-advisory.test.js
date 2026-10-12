// MA-1944: Ladon legendary_actions[3] "Vigilant Watch (Costs 2 Actions)"
// was a prose child with delegates_to:null and NO advisory — the MA-0510
// silent-burn fingerprint confirmed live: the gated "Expend Legendary" chip
// spent exactly 2 (MA-1883 cost lane honest) but resolveLegendaryRowMechanic
// fell to the console.error dead-end (MonsterCardModal.jsx:776) — popup audit
// empty, no fixed-target / +5-to-hit rider record, control legendary Bite
// rolled +15 never +20, targetEffects ABSENT across every store.
// Fix: flat advisory fields §253 honest advisory-floor — MA-1936 King Kong
// Climbing Dash byte-shape twin (same monster card, same Modal :755 advisory
// branch) + MA-1851 Spell Absorption precedent. advisory is inspected BEFORE
// the numeric/delegate legs (Modal :755), so delegates_to:null stays
// byte-unchanged (NEVER delegates_to a weapon — MA-1847 forces an
// un-optional full attack) and the press becomes an honest record-only popup
// + ability_use "GM-enforced" log while the costs-2 gate keeps spending 2.
// Residuals (accepted §70 zero-consumer floor, advisory copy only):
// fixed-target state, +5-to-hit attacker rider, monster Opportunity Attack
// surface (Ladon reactions:[] — OA machinery is PC-side only), expiry clock.
// Costs-2 enforcement is LIVE, not residual.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  legendaryHeaderAction,
  legendaryActionCost,
  expendLegendaryUse,
  buildLegendaryAdvisoryPopup,
  buildLegendaryAdvisoryLog,
  hasLegendaryCooldownClause,
} from './monsterLegendaryUses.js';
import { isMonsterActionAdvisoryRow } from './monsterActionAdvisory.js';

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const LADON = monsters.find((m) => m.index === 'ladon');
const WATCH = LADON.legendary_actions[3];

describe('MA-1944 disk fingerprint: Ladon Vigilant Watch flat advisory authored', () => {
  it('row identity byte-locked with advisory + advisory_message after delegates_to, before description', () => {
    expect(LADON.name).toBe('Ladon');
    expect(WATCH.name).toBe('Vigilant Watch (Costs 2 Actions)');
    expect(Object.keys(WATCH)).toEqual(['name', 'delegates_to', 'advisory', 'advisory_message', 'description']);
    expect(WATCH.delegates_to).toBeNull();
    expect(WATCH.advisory).toBe('vigilant_watch');
    expect(WATCH.advisory_message).toBe("Ladon fixes one target. Until the start of his next turn, his next Opportunity Attack against that target has +5 to hit — GM-enforced; no fixed-target or monster Opportunity Attack consumer exists in the app.");
    expect(WATCH.description).toBe("Ladon fixes one target. Until the start of his next turn, his next Opportunity Attack against that target has +5 to hit.");
  });

  it('advisory_message carries the RAW numerics honestly (fix-target + +5-to-hit) and the GM-enforced residual', () => {
    expect(WATCH.advisory_message).toContain('+5');
    expect(WATCH.advisory_message).toContain('GM-enforced');
    expect(WATCH.advisory_message).toContain('fixes one target');
    expect(WATCH.advisory_message).toContain('Opportunity Attack');
  });

  it('row authors NO numeric/mechanic fields — advisory child never rolls (§168 child template, MA-1847 axis closed)', () => {
    expect(WATCH.attack_bonus).toBeUndefined();
    expect(WATCH.save_dc).toBeUndefined();
    expect(WATCH.damage_dice_primary).toBeUndefined();
    expect(WATCH.uses).toBeUndefined();
    // No per-action cooldown clause on this row — boundary economy only.
    expect(hasLegendaryCooldownClause(WATCH)).toBe(false);
  });

  it('Ladon has no monster-side Opportunity Attack surface — advisory is the honest floor (§70)', () => {
    expect(LADON.reactions).toEqual([]);
  });

  it('advisory arm recognized: predicate true, advisory_message twin wins over MA-0058 invisibility fallback copy', () => {
    expect(isMonsterActionAdvisoryRow(WATCH)).toBe(true);
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'Ladon 1', action: WATCH });
    expect(html).toContain('<div class="mc-prerequisite-refusal">');
    expect(html).toContain('<h3>Legendary Action — Vigilant Watch (Costs 2 Actions)</h3>');
    expect(html).toContain('Ladon 1 Ladon fixes one target');
    expect(html).toContain('+5 to hit — GM-enforced; no fixed-target or monster Opportunity Attack consumer exists in the app.');
    expect(html).not.toContain('casts vigilant watch on itself');
  });

  it('advisory log is an honest ability_use record naming the row and the GM-enforced residual', () => {
    const entry = buildLegendaryAdvisoryLog({ monsterName: 'Ladon 1', action: WATCH });
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Ladon 1');
    expect(entry.abilityName).toBe('Vigilant Watch (Costs 2 Actions)');
    expect(entry.description).toBe('Ladon 1 legendary action Vigilant Watch (Costs 2 Actions): Ladon 1 Ladon fixes one target. Until the start of his next turn, his next Opportunity Attack against that target has +5 to hit — GM-enforced; no fixed-target or monster Opportunity Attack consumer exists in the app.');
  });
});

describe('MA-1944 advisory Vigilant Watch rides the shared legendary economy (costs-2 stays live)', () => {
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

  it('header byte-unchanged uses:3; cost parsed from name = 2 (MA-1883)', () => {
    const header = legendaryHeaderAction(LADON);
    expect(header.uses).toBe(3);
    expect(header.name).toBe('Legendary Action Uses: 3');
    expect(legendaryActionCost(WATCH)).toBe(2);
  });

  it('legal-boundary press spends exactly 2 with the honest multi-spend counter log', async () => {
    const r = await expendLegendaryUse({ monsterName: 'Ladon 1', monster: LADON, actionName: WATCH.name, action: WATCH, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 1, max: 3 });
    expect(store['Ladon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toBe("Ladon 1 spends 2 legendary uses for Vigilant Watch (Costs 2 Actions) after Bandit 1's turn — 1 of 3 left (regain at the start of Ladon 1's turn; 4 in lair advisory).");
  });

  it('same-boundary re-press refuses turn-latch with ZERO extra spend (gate order turn→cost)', async () => {
    await expendLegendaryUse({ monsterName: 'Ladon 1', monster: LADON, actionName: WATCH.name, action: WATCH, campaignName: 'test-campaign', deps });
    const refused = await expendLegendaryUse({ monsterName: 'Ladon 1', monster: LADON, actionName: WATCH.name, action: WATCH, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(refused.reason).toBe('turn');
    expect(store['Ladon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);
  });

  it('cost-floor control at 1-left refuses insufficient-cost with zero spend', async () => {
    store['Ladon 1.monsterLegendaryUses'] = { max: 3, used: 2 };
    const refused = await expendLegendaryUse({ monsterName: 'Ladon 1', monster: LADON, actionName: WATCH.name, action: WATCH, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(refused.reason).toBe('insufficient-cost');
    expect(refused.popupHtml).toContain('costs 2 legendary uses but Ladon 1 has only 1 left');
    expect(logs[0].description).toContain('insufficient-cost: costs 2, 1 left');
    expect(store['Ladon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
  });

  it('insufficient-cost at 0-left refuses exhausted with zero spend', async () => {
    store['Ladon 1.monsterLegendaryUses'] = { max: 3, used: 3 };
    const refused = await expendLegendaryUse({ monsterName: 'Ladon 1', monster: LADON, actionName: WATCH.name, action: WATCH, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(store['Ladon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
  });
});

describe('MA-1944 card siblings intact', () => {
  it('header + Bite delegate + Coil delegate byte-locked (not re-added this pass)', () => {
    const header = LADON.legendary_actions[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.uses).toBe(3);
    const bite = LADON.legendary_actions[1];
    expect(Object.keys(bite)).toEqual(['name', 'delegates_to', 'description']);
    expect(bite.delegates_to).toBe('Bite');
    expect(bite.advisory).toBeUndefined();
    const coil = LADON.legendary_actions[2];
    expect(Object.keys(coil)).toEqual(['name', 'description', 'delegates_to']);
    expect(coil.delegates_to).toBe('Constrict');
    expect(coil.advisory).toBeUndefined();
  });
});
