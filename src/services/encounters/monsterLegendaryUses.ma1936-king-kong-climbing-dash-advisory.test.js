// MA-1936: King Kong legendary_actions[3] "Climbing Dash (Costs 2 Actions)"
// was a prose child with delegates_to:null and NO advisory — the MA-0510/
// MA-0696 silent-burn fingerprint confirmed live: the gated "Expend Legendary"
// chip spent exactly 2 (MA-1883 cost lane honest) but resolveLegendaryRowMechanic
// fell to the console.error dead-end (MonsterCardModal.jsx:776) — popup audit
// empty, RAW movement / no-opportunity-attacks / optional mid-path Slam never
// adjudicated nor named GM-enforced.
// Fix: flat advisory fields §253 movement-row template (Tarrasque MA-1581 /
// Seahorse Bubble Dash MA-1450 / Cloaked Flight MA-0058 family) — advisory is
// inspected BEFORE the numeric/delegate legs (Modal :755), so delegates_to:null
// stays byte-unchanged (NEVER delegates_to:"Slam" — MA-1847 forces an
// un-optional full Slam) and the press becomes an honest record-only popup +
// ability_use "GM-enforced" log while the costs-2 gate keeps spending 2.
// Residuals (accepted §70 movement floor, advisory copy only): grid token
// move, OA-suppression register, climbing/vertical movement, optional
// mid-path Slam auto-fire. Costs-2 enforcement is LIVE, not residual.
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
const KING_KONG = monsters.find((m) => m.index === 'king-kong');
const DASH = KING_KONG.legendary_actions[3];

describe('MA-1936 disk fingerprint: King Kong Climbing Dash flat advisory authored', () => {
  it('row identity byte-locked with advisory + advisory_message after delegates_to, before description', () => {
    expect(KING_KONG.name).toBe('King Kong');
    expect(DASH.name).toBe('Climbing Dash (Costs 2 Actions)');
    expect(Object.keys(DASH)).toEqual(['name', 'delegates_to', 'advisory', 'advisory_message', 'description']);
    expect(DASH.delegates_to).toBeNull();
    expect(DASH.advisory).toBe('climbing_dash');
    expect(DASH.advisory_message).toBe("Kong moves up to his Speed without provoking Opportunity Attacks, climbing or swinging, and can make one Slam attack at any point along the path — GM-enforced movement; resolve any optional mid-path Slam as a separate Slam action (GM-enforced).");
    expect(DASH.description).toBe("Kong moves up to his Speed without provoking Opportunity Attacks, climbing or swinging, and can make one Slam attack at any point along the path.");
  });

  it('row authors NO numeric/mechanic fields — advisory child never rolls (§168 child template, MA-1847 axis closed)', () => {
    expect(DASH.attack_bonus).toBeUndefined();
    expect(DASH.save_dc).toBeUndefined();
    expect(DASH.damage_dice_primary).toBeUndefined();
    expect(DASH.uses).toBeUndefined();
    // No per-action cooldown clause on this row — boundary economy only.
    expect(hasLegendaryCooldownClause(DASH)).toBe(false);
  });

  it('advisory arm recognized: predicate true, advisory_message twin wins over MA-0058 invisibility fallback copy', () => {
    expect(isMonsterActionAdvisoryRow(DASH)).toBe(true);
    const html = buildLegendaryAdvisoryPopup({ monsterName: 'King Kong 1', action: DASH });
    expect(html).toContain('<div class="mc-prerequisite-refusal">');
    expect(html).toContain('<h3>Legendary Action — Climbing Dash (Costs 2 Actions)</h3>');
    expect(html).toContain('King Kong 1 Kong moves up to his Speed without provoking Opportunity Attacks');
    expect(html).toContain('GM-enforced movement; resolve any optional mid-path Slam as a separate Slam action (GM-enforced).');
    expect(html).not.toContain('casts climbing dash on itself');
  });

  it('advisory log is an honest ability_use record naming the row and the GM-enforced residual', () => {
    const entry = buildLegendaryAdvisoryLog({ monsterName: 'King Kong 1', action: DASH });
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('King Kong 1');
    expect(entry.abilityName).toBe('Climbing Dash (Costs 2 Actions)');
    expect(entry.description).toBe('King Kong 1 legendary action Climbing Dash (Costs 2 Actions): King Kong 1 Kong moves up to his Speed without provoking Opportunity Attacks, climbing or swinging, and can make one Slam attack at any point along the path — GM-enforced movement; resolve any optional mid-path Slam as a separate Slam action (GM-enforced).');
  });
});

describe('MA-1936 advisory Climbing Dash rides the shared legendary economy (costs-2 stays live)', () => {
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
    const header = legendaryHeaderAction(KING_KONG);
    expect(header.uses).toBe(3);
    expect(header.name).toBe('Legendary Action Uses: 3');
    expect(legendaryActionCost(DASH)).toBe(2);
  });

  it('legal-boundary press spends exactly 2 with the honest multi-spend counter log', async () => {
    const r = await expendLegendaryUse({ monsterName: 'King Kong 1', monster: KING_KONG, actionName: DASH.name, action: DASH, campaignName: 'test-campaign', deps });
    expect(r).toEqual({ spent: true, remaining: 1, max: 3 });
    expect(store['King Kong 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toBe("King Kong 1 spends 2 legendary uses for Climbing Dash (Costs 2 Actions) after Bandit 1's turn — 1 of 3 left (regain at the start of King Kong 1's turn; 4 in lair advisory).");
  });

  it('same-boundary re-press refuses turn-latch with ZERO extra spend (gate order turn→cost)', async () => {
    await expendLegendaryUse({ monsterName: 'King Kong 1', monster: KING_KONG, actionName: DASH.name, action: DASH, campaignName: 'test-campaign', deps });
    const refused = await expendLegendaryUse({ monsterName: 'King Kong 1', monster: KING_KONG, actionName: DASH.name, action: DASH, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(refused.reason).toBe('turn');
    expect(store['King Kong 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
    expect(logs.some(e => e.automationType === 'legendary_use_refused')).toBe(true);
  });

  it('cost-floor control at 1-left refuses insufficient-cost with zero spend', async () => {
    store['King Kong 1.monsterLegendaryUses'] = { max: 3, used: 2 };
    const refused = await expendLegendaryUse({ monsterName: 'King Kong 1', monster: KING_KONG, actionName: DASH.name, action: DASH, campaignName: 'test-campaign', deps });
    expect(refused.spent).toBe(false);
    expect(refused.reason).toBe('insufficient-cost');
    expect(refused.popupHtml).toContain('costs 2 legendary uses but King Kong 1 has only 1 left');
    expect(logs[0].description).toContain('insufficient-cost: costs 2, 1 left');
    expect(store['King Kong 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 });
  });
});

describe('MA-1936 card siblings intact', () => {
  it('header + Slam delegate + numeric Rock Throw byte-locked (not re-added this pass)', () => {
    const header = KING_KONG.legendary_actions[0];
    expect(Object.keys(header)).toEqual(['name', 'uses', 'description']);
    expect(header.uses).toBe(3);
    const slam = KING_KONG.legendary_actions[1];
    expect(Object.keys(slam)).toEqual(['name', 'delegates_to', 'description']);
    expect(slam.delegates_to).toBe('Slam');
    const rock = KING_KONG.legendary_actions[2];
    expect(Object.keys(rock)).toEqual(['name', 'description', 'range', 'attack_bonus', 'damage_dice_primary', 'damage_type_primary']);
    expect(rock.attack_bonus).toBe(17);
    expect(rock.damage_dice_primary).toBe('3d10 + 10');
    expect(rock.advisory).toBeUndefined();
  });
});
