// @maintained-by-ai
// Nick mastery lane (weaponMasteryHandler.applyNickMastery): once-per-turn latch
// written to the player's '_Nick_UsedRound' runtime key as a PLAIN round number
// (consumers attackCalc2024 / CharBonusActions compare it against
// getCurrentCombatRound()). Self-mode flag — no targetEffect is ever written.
// Description-lane strings owned by weaponMasteryHandler.description.test.js;
// this file only pins the refusal text composed inside applyNickMastery itself.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({})),
  getTargetFromAttacker: vi.fn(() => null),
}));
vi.mock('../../../combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn(),
}));
vi.mock('../../../rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../common/oncePerTurn.js', () => ({
  checkOncePerTurn: vi.fn(() => Promise.resolve(null)),
  markOncePerTurn: vi.fn(() => Promise.resolve({})),
}));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 4),
}));

const { applyMasteryEffect } = await import('./weaponMasteryHandler.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getCurrentCombatRound } = await import('../../../../services/encounters/combatData.js');
const { addEntry } = await import('../../../ui/logService.js');

const playerStats = { name: 'Fighter', level: 18, abilities: [{ name: 'Strength', bonus: 4 }] };

describe('applyMasteryEffect — Nick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCombatRound.mockReturnValue(4);
    getRuntimeValue.mockReturnValue(null);
  });

  it('latches _Nick_UsedRound to the current round, logs ability_use, and returns the Nick mastery_rider popup', async () => {
    const result = await applyMasteryEffect('Nick', playerStats, 'test-campaign', 'Rug');

    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', '_Nick_UsedRound', 4, 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Fighter',
        abilityName: 'Nick',
        description: 'Fighter used Nick on Rug — Light weapon extra attack is now part of the Attack action.',
        targetName: 'Rug',
      })
    );
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Nick');
    expect(result.payload.automation).toEqual({ type: 'mastery_rider', masteries: ['Nick'] });
  });

  // WM-003 F3: the refusal is still a refusal (zero latch write) but must LOG
  // nick_refused and flag the popup payload refused for the modal surface.
  it('blocks a second use in the same round, logs nick_refused, and does not write the latch again', async () => {
    getRuntimeValue.mockImplementation((name, key) => (key === '_Nick_UsedRound' ? 4 : null));

    const result = await applyMasteryEffect('Nick', playerStats, 'test-campaign', 'Rug');

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'automation',
        automationType: 'nick_refused',
        characterName: 'Fighter',
        targetName: 'Rug',
        description: 'Fighter can use Nick only once per turn.',
      })
    );
    expect(result.payload.refused).toBe(true);
    expect(result.payload.name).toBe('Nick');
    expect(result.payload.description).toBe('Fighter can use Nick only once per turn.');
  });

  it('allows Nick again on a later round when the stored round is stale', async () => {
    getCurrentCombatRound.mockReturnValue(5);
    getRuntimeValue.mockImplementation((name, key) => (key === '_Nick_UsedRound' ? 4 : null));

    const result = await applyMasteryEffect('Nick', playerStats, 'test-campaign', 'Rug');

    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', '_Nick_UsedRound', 5, 'test-campaign');
    expect(result.type).toBe('popup');
    expect(result.payload.refused).toBeUndefined();
    expect(result.payload.description || '').not.toMatch(/once per turn/i);
  });

  it('latches and logs without a target when targetName is omitted', async () => {
    const result = await applyMasteryEffect('Nick', playerStats, 'test-campaign', undefined);

    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', '_Nick_UsedRound', 4, 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Nick',
        description: 'Fighter used Nick — Light weapon extra attack is now part of the Attack action.',
        targetName: null,
      })
    );
    expect(result.type).toBe('popup');
    expect(result.payload.refused).toBeUndefined();
  });

  it('does NOT mark _Nick_UsedRound when a different mastery is chosen (Skip/replace)', async () => {
    await applyMasteryEffect('Slow', playerStats, 'test-campaign', 'Rug');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Fighter', '_Nick_UsedRound', expect.anything(), 'test-campaign');
  });
});
