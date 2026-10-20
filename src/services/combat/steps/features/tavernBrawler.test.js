// @maintained-by-ai
/**
 * Tavern Brawler REROLL-CORE lane. Contract (tavernBrawler.js):
 *   condition: unarmed weaponType + dice damage + automation present (coarse gate).
 *   handler: 'tavern_brawler_reroll_ones' passive required (else null); every
 *   damage die showing 1 is rerolled rv = floor(rand*ds)+1, total recomputed,
 *   ' [Tavern Brawler]' appended to formula, ctx.tavernBrawlerRerolls stamped,
 *   one exact log entry. Unparseable formula or empty rolls → silent pass-through.
 *
 * Pair-split table (no lane re-drives another's bytes):
 *   this file            — reroll bytes, exact log, pass-through, near-miss passive
 *   tavernBrawlerPush.test.js       — push lane: once-per-turn latch, MA-0079 te marker
 *   useAttackDamageResolution.feats.test.js — push dispatch at the pipeline seam (integration)
 *
 * Old→new map (7 → 6 tests):
 *   condition 'passes'/'fails melee'/'fails no damage' → one condition truth table
 *     (+FT-090 melee-collapse falsifier, +no-automation falsifier)
 *   handler 'rerolls dice showing 1' + 'logs each reroll' → single-die exact full
 *     result toEqual + exact log entry (#829 log exact mandate)
 *   NEW: multi-die partial reroll, distinguishable bytes + dice-consumption tripwire
 *   'leaves dice without a 1 untouched' → silent pass-through, zero-side-effect honesty
 *   'returns null without the reroll passive' → near-miss falsifier (#1053), zero side effects
 *   NEW: pass-through branch (unparseable formula | empty rolls)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock audit: logService is the source's only import besides contract helpers — live.
vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { tavernBrawler } from './tavernBrawler.js';
import { addEntry } from '../../../ui/logService.js';

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: {
      name: 'BrawlerBob',
      automation: { passives: [{ effect: 'tavern_brawler_reroll_ones' }] },
    },
    attack: { name: 'Unarmed Strike', weaponType: 'unarmed', damage: '1d4+3' },
    targetName: 'Bandit 1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tavernBrawler.condition', () => {
  it('gates on unarmed weaponType + dice damage + automation passives (truth table)', () => {
    expect(tavernBrawler.condition(makeCtx())).toBe(true);

    const falsifiers = [
      ['armed melee weapon', { attack: { name: 'Longsword', weaponType: 'melee', damage: '1d8+3' } }],
      // FT-090 guard: unarmed rows collapse to melee weaponType upstream —
      // the flag alone must never false-fire this weaponType-based gate.
      ['melee-collapsed row carrying isUnarmedStrike', { attack: { name: 'Longsword', weaponType: 'melee', damage: '1d8+3', isUnarmedStrike: true } }],
      ['unarmed attack without a damage formula', { attack: { name: 'Unarmed Strike', weaponType: 'unarmed' } }],
      ['character without automation', { playerStats: { name: 'BrawlerBob' } }],
    ];
    for (const [label, overrides] of falsifiers) {
      expect(tavernBrawler.condition(makeCtx(overrides)), label).toBe(false);
    }
  });
});

describe('tavernBrawler.handler', () => {
  it('rerolls the single die showing 1 — exact result bytes, ctx stamp, and full log entry', async () => {
    // Hand-derived once (1d4+3, roll 1, rand 0.99): rv = floor(0.99*4)+1 = 4;
    // total = 4 + (4-1) = 7.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ctx = makeCtx();

    const result = await tavernBrawler.handler(ctx, { formula: '1d4+3', total: 4, rolls: [1] });

    expect(result).toEqual({ data: { formula: '1d4+3 [Tavern Brawler]', total: 7, rolls: [4] } });
    expect(ctx.tavernBrawlerRerolls).toEqual([{ original: 1, rerolled: 4 }]);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'BrawlerBob',
      abilityName: 'Tavern Brawler',
      description: 'Tavern Brawler Damage Reroll: rerolled 1 damage die showing 1 on Unarmed Strike — new values 4.',
      targetName: 'Bandit 1',
      timestamp: expect.any(Number),
    });
  });

  it('partial multi-die reroll rerolls ONLY the dice showing 1, distinguishable bytes', async () => {
    // 3d8+2 with rolls [1,3,1] total 7. Deterministic dice table consumed in
    // index order (index 1 skips the roll): rv0 = floor(0.99*8)+1 = 8,
    // rv2 = floor(0.5*8)+1 = 5; total = 7 + 7 + 4 = 18; new rolls [8,3,5].
    const dice = [0.99, 0.5];
    const random = vi.spyOn(Math, 'random').mockImplementation(() => dice.shift());
    const ctx = makeCtx({ attack: { name: 'Unarmed Strike', weaponType: 'unarmed', damage: '3d8+2' } });

    const result = await tavernBrawler.handler(ctx, { formula: '3d8+2', total: 7, rolls: [1, 3, 1] });

    expect(result).toEqual({ data: { formula: '3d8+2 [Tavern Brawler]', total: 18, rolls: [8, 3, 5] } });
    expect(ctx.tavernBrawlerRerolls).toEqual([
      { original: 1, rerolled: 8 },
      { original: 1, rerolled: 5 },
    ]);
    // Tripwire: exactly one Math.random per die showing 1 — non-1s never roll.
    expect(random).toHaveBeenCalledTimes(2);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry.mock.calls[0][1].description).toBe(
      'Tavern Brawler Damage Reroll: rerolled 2 damage die showing 1 on Unarmed Strike — new values 8, 5.'
    );
  });

  it('dice without a 1 pass through byte-identical and silently (no log, no ctx write)', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ctx = makeCtx();
    const prevData = { formula: '1d4+3', total: 6, rolls: [3] };

    const result = await tavernBrawler.handler(ctx, prevData);

    expect(result).toEqual({ data: { formula: '1d4+3', total: 6, rolls: [3] } });
    expect(ctx).not.toHaveProperty('tavernBrawlerRerolls');
    expect(addEntry).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('near-miss falsifier: push-only passive with dice loaded with 1s returns null, zero side effects', async () => {
    // Same trigger lane (unarmed strike), off-lane passive (#1053) —
    // the reroll handler must not fire on it.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ctx = makeCtx();
    ctx.playerStats.automation.passives = [{ effect: 'tavern_brawler_push' }];

    const result = await tavernBrawler.handler(ctx, { formula: '1d4+3', total: 4, rolls: [1] });

    expect(result).toBeNull();
    expect(ctx).not.toHaveProperty('tavernBrawlerRerolls');
    expect(addEntry).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('unparseable formula or empty rolls pass prevData through untouched, no log', async () => {
    const cases = [
      ['flat damage formula (no NdN match)', { name: 'Unarmed Strike', weaponType: 'unarmed', damage: '3+3' }, { formula: '3+3', total: 3, rolls: [3] }],
      ['dice formula but empty rolls', { name: 'Unarmed Strike', weaponType: 'unarmed', damage: '1d4+3' }, { formula: '1d4+3', total: 3, rolls: [] }],
    ];
    for (const [label, attack, prevData] of cases) {
      addEntry.mockClear();
      const ctx = makeCtx({ attack });
      const result = await tavernBrawler.handler(ctx, prevData);
      expect(result, label).toEqual({ data: prevData });
      expect(addEntry, label).not.toHaveBeenCalled();
    }
  });
});
