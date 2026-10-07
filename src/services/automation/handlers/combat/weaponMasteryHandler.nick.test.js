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

  it('marks _Nick_UsedRound with the current round number and logs ability_use', async () => {
    const result = await applyMasteryEffect('Nick', playerStats, 'test-campaign', 'Rug');

    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', '_Nick_UsedRound', 4, 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        abilityName: 'Nick',
        targetName: 'Rug',
      })
    );
    expect(result.type).toBe('popup');
    expect(result.payload.name).toBe('Nick');
  });

  it('writes a plain round number (not an object) so consumers can match getCurrentCombatRound', async () => {
    await applyMasteryEffect('Nick', playerStats, 'test-campaign', 'Rug');
    const write = setRuntimeValue.mock.calls.find(c => c[1] === '_Nick_UsedRound');
    expect(typeof write[2]).toBe('number');
    expect(write[2]).toBe(getCurrentCombatRound('test-campaign'));
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
      })
    );
    expect(result.payload.refused).toBe(true);
    expect(result.payload.description).toMatch(/once per turn/i);
  });

  it('allows Nick again on a later round when the stored round is stale', async () => {
    getCurrentCombatRound.mockReturnValue(5);
    getRuntimeValue.mockImplementation((name, key) => (key === '_Nick_UsedRound' ? 4 : null));

    const result = await applyMasteryEffect('Nick', playerStats, 'test-campaign', 'Rug');

    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', '_Nick_UsedRound', 5, 'test-campaign');
    expect(result.type).toBe('popup');
    expect(result.payload.description || '').not.toMatch(/once per turn/i);
  });

  it('does NOT mark _Nick_UsedRound when a different mastery is chosen (Skip/replace)', async () => {
    await applyMasteryEffect('Slow', playerStats, 'test-campaign', 'Rug');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Fighter', '_Nick_UsedRound', expect.anything(), 'test-campaign');
  });
});
