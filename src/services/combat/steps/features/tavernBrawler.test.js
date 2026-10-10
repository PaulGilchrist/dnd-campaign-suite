import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { tavernBrawler } from './tavernBrawler.js';
import { addEntry } from '../../../ui/logService.js';

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: {
      name: 'EvasiveFighter',
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

describe('tavernBrawler.condition', () => {
  it('passes for unarmed damage with passives', () => {
    expect(tavernBrawler.condition(makeCtx())).toBe(true);
  });

  it('fails when weaponType is melee', () => {
    expect(tavernBrawler.condition(makeCtx({ attack: { name: 'Longsword', weaponType: 'melee', damage: '1d8+3' } }))).toBe(false);
  });

  it('fails without attack damage', () => {
    const ctx = makeCtx();
    delete ctx.attack.damage;
    expect(tavernBrawler.condition(ctx)).toBe(false);
  });
});

describe('tavernBrawler.handler', () => {
  it('rerolls damage dice showing 1', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ctx = makeCtx();
    const result = await tavernBrawler.handler(ctx, { formula: '1d4+3', total: 4, rolls: [1] });
    expect(result.data.rolls).toEqual([4]);
    expect(result.data.total).toBe(7);
    expect(result.data.formula).toContain('[Tavern Brawler]');
    expect(ctx.tavernBrawlerRerolls).toEqual([{ original: 1, rerolled: 4 }]);
    Math.random.mockRestore();
  });

  it('leaves dice without a 1 untouched and logs nothing', async () => {
    const ctx = makeCtx();
    const result = await tavernBrawler.handler(ctx, { formula: '1d4+3', total: 6, rolls: [3] });
    expect(result.data.rolls).toEqual([3]);
    expect(result.data.formula).not.toContain('[Tavern Brawler]');
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('logs each reroll to the campaign log', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await tavernBrawler.handler(makeCtx(), { formula: '2d4+3', total: 5, rolls: [1, 1] });
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ abilityName: 'Tavern Brawler' }));
    Math.random.mockRestore();
  });

  it('returns null without the reroll passive', async () => {
    const ctx = makeCtx();
    ctx.playerStats.automation.passives = [{ effect: 'tavern_brawler_push' }];
    expect(await tavernBrawler.handler(ctx, { formula: '1d4+3', total: 4, rolls: [1] })).toBeNull();
  });
});
