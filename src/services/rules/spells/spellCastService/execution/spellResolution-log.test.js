// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — the surface area that spellResolution.js imports           */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_playerName, _key, _campaignName) => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../../../automation/handlers/class-warlock/psychicSpellsHandler.js', () => ({
  getPsychicSpellsConfig: vi.fn(() => null),
}));

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../core/spellDamageUtils.js', () => ({
  resolveSpellDamageWithTypes: vi.fn(() => null),
}));

/* ------------------------------------------------------------------ */
/*  SUT imports after mocks are established                            */
/* ------------------------------------------------------------------ */

import { logGenericSpellCast } from './spellResolution.js';
import { addEntry } from '../../../../ui/logService.js';

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  beforeEach — reset all mock implementations to safe defaults       */
/* ------------------------------------------------------------------ */

describe('logGenericSpellCast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Promise that resolves when spell is not Hex', async () => {
    const spell = { name: 'Fireball', level: 3, casting_time: '1 action', concentration: false };
    const fullSpell = { description: ['A bright flash', 'of lightning'] };
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Goblin' }));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: fullSpell,
      damageType: 'Lightning',
      formula: '2d6',
      spellSaveDc: 15,
    });

    expect(result).toBeInstanceOf(Promise);
    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'spell',
      characterName: 'TestWizard',
      targetName: 'Goblin',
      spellName: 'Fireball',
      spellLevel: 3,
      castingTime: '1 action',
      damageType: 'Lightning',
      damageFormula: '2d6',
      saveDC: null,
      concentration: false,
      description: 'A bright flash of lightning',
    }));
  });

  it('resolves immediately when spell name is Hex', async () => {
    const spell = { name: 'Hex' };
    const getTargetInfo = vi.fn();

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: {},
      damageType: null,
      formula: null,
      spellSaveDc: 0,
    });

    expect(result).toBeInstanceOf(Promise);
    await result;

    expect(getTargetInfo).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('uses spell.dc to determine saveDC value', async () => {
    const spell = { name: 'Fireball', level: 3, casting_time: '1 action', concentration: false, dc: { dc_type: 'dex' } };
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Goblin' }));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: {},
      damageType: 'Fire',
      formula: '8d6',
      spellSaveDc: 15,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      saveDC: 15,
    }));
  });

  it('uses null saveDC when spell.dc is falsy', async () => {
    const spell = { name: 'Fireball', level: 3, casting_time: '1 action', concentration: false };
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Goblin' }));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: {},
      damageType: 'Fire',
      formula: '8d6',
      spellSaveDc: 15,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      saveDC: null,
    }));
  });

  it('handles missing description gracefully', async () => {
    const spell = { name: 'Fireball' };
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Target' }));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: {},
      damageType: null,
      formula: null,
      spellSaveDc: 0,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      description: null,
    }));
  });

  it('handles description as array', async () => {
    const spell = { name: 'Fireball' };
    const fullSpell = { description: ['Line 1', 'Line 2', 'Line 3'] };
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Target' }));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: fullSpell,
      damageType: null,
      formula: null,
      spellSaveDc: 0,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      description: 'Line 1 Line 2 Line 3',
    }));
  });

  it('handles null description', async () => {
    const spell = { name: 'Fireball' };
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Target' }));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: { description: null },
      damageType: null,
      formula: null,
      spellSaveDc: 0,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      description: null,
    }));
  });

  it('defaults spellLevel to 0 when spell.level is missing', async () => {
    const spell = { name: 'Fireball' };
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Target' }));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: {},
      damageType: null,
      formula: null,
      spellSaveDc: 0,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      spellLevel: 0,
    }));
  });

  it('passes spell.dc when present for saveDC', async () => {
    const spell = { name: 'Fireball', dc: { dc_type: 'dex', dc_success: 'half' } };
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Target' }));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: {},
      damageType: 'Fire',
      formula: '8d6',
      spellSaveDc: 15,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      saveDC: 15,
    }));
  });

  it('handles null target from getTargetInfo', async () => {
    const spell = { name: 'Fireball' };
    const getTargetInfo = vi.fn(() => Promise.resolve(null));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: {},
      damageType: null,
      formula: null,
      spellSaveDc: 0,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: null,
    }));
  });

  it('handles undefined target from getTargetInfo', async () => {
    const spell = { name: 'Fireball' };
    const getTargetInfo = vi.fn(() => Promise.resolve(undefined));

    const result = logGenericSpellCast({
      spell,
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
      getTargetInfo,
      fullSpell: {},
      damageType: null,
      formula: null,
      spellSaveDc: 0,
    });

    await result;

    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: null,
    }));
  });
});
