import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePowerWordKill, handlePowerWordHeal } from './modalSpells.js';
import { getCombatContext } from '../../../combat/damageUtils.js';

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => ({ creatures: [{ name: 'Thug 1', currentHp: 32 }, { name: 'Thug 2', currentHp: 32 }] })),
}));

const CAMPAIGN = 'test-campaign';

function makePlayerStats() {
  return { name: 'HeroesFeastBard', level: 20, class: { name: 'Bard' } };
}

describe('CLA-392 Words of Creation spread — first target never skipped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handlePowerWordKill applies to the FIRST target AND the multiTarget second target', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(async () => ({ name: 'Thug 1' }));

    const result = await handlePowerWordKill(
      { name: 'Power Word Kill' },
      { multiTarget: 'Thug 2' },
      getTargetInfo,
      makePlayerStats(),
      CAMPAIGN,
      apply
    );

    expect(result).toEqual({ handled: true });
    expect(getTargetInfo).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(2);
    const sharedCs = await getCombatContext(CAMPAIGN);
    expect(apply).toHaveBeenNthCalledWith(1, 'Thug 1', expect.objectContaining({ name: 'HeroesFeastBard' }), CAMPAIGN, sharedCs);
    expect(apply).toHaveBeenNthCalledWith(2, 'Thug 2', expect.objectContaining({ name: 'HeroesFeastBard' }), CAMPAIGN, sharedCs);
  });

  it('handlePowerWordKill applies once when multiTarget equals the first target', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(async () => ({ name: 'Thug 1' }));

    const result = await handlePowerWordKill(
      { name: 'Power Word Kill' },
      { multiTarget: 'Thug 1' },
      getTargetInfo,
      makePlayerStats(),
      CAMPAIGN,
      apply
    );

    expect(result).toEqual({ handled: true });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('Thug 1', expect.objectContaining({ name: 'HeroesFeastBard' }), CAMPAIGN, expect.any(Object));
  });

  it('handlePowerWordKill skip path still applies to the resolved first target', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(async () => ({ name: 'Thug 1' }));

    const result = await handlePowerWordKill(
      { name: 'Power Word Kill' },
      {},
      getTargetInfo,
      makePlayerStats(),
      CAMPAIGN,
      apply
    );

    expect(result).toEqual({ handled: true });
    expect(getTargetInfo).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('Thug 1', expect.objectContaining({ name: 'HeroesFeastBard' }), CAMPAIGN, expect.any(Object));
  });

  it('handlePowerWordHeal applies to the FIRST target AND the multiTarget second target', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(async () => ({ name: 'Thug 1' }));

    const result = await handlePowerWordHeal(
      { name: 'Power Word Heal' },
      { multiTarget: 'Thug 2' },
      getTargetInfo,
      makePlayerStats(),
      CAMPAIGN,
      apply
    );

    expect(result).toEqual({ handled: true });
    expect(getTargetInfo).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(2);
    const sharedCs = await getCombatContext(CAMPAIGN);
    expect(apply).toHaveBeenNthCalledWith(1, 'Thug 1', expect.objectContaining({ name: 'HeroesFeastBard' }), CAMPAIGN, sharedCs);
    expect(apply).toHaveBeenNthCalledWith(2, 'Thug 2', expect.objectContaining({ name: 'HeroesFeastBard' }), CAMPAIGN, sharedCs);
  });

  it('handlePowerWordHeal skip path still applies to the resolved first target', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(async () => ({ name: 'Thug 1' }));

    const result = await handlePowerWordHeal(
      { name: 'Power Word Heal' },
      {},
      getTargetInfo,
      makePlayerStats(),
      CAMPAIGN,
      apply
    );

    expect(result).toEqual({ handled: true });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('Thug 1', expect.objectContaining({ name: 'HeroesFeastBard' }), CAMPAIGN, expect.any(Object));
  });
});
