// CLA-087 regression: Disciplined Survivor reroll must thread the real
// campaignName/characters into doReroll so the save bonus (+10 all-saves-prof
// monk) and aura stacking apply to the rerolled die — not raw d20 + 0.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createDisciplinedSurvivorHandler, createFanaticalFocusHandler } from './savePromptHandlers.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { getSaveDisadvantage } from './savePromptUtils.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 19),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 10),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./savePromptUtils.js', () => ({
  getSaveDisadvantage: vi.fn(() => false),
}));

const current = {
  promptId: 'p1',
  targetName: 'Disciplined_Monk',
  saveType: 'WIS',
  saveDc: 19,
  dcSuccess: 'half',
  rawDamage: 14,
  damageFormula: '4d8',
  damageType: 'Psychic',
  sourceName: 'Mind Spike',
};

const monkCharacter = { name: 'Disciplined_Monk', level: 18, computedStats: { level: 18 } };

function makeHandler(overrides) {
  return createDisciplinedSurvivorHandler({
    campaignName: 'test-campaign',
    characters: [monkCharacter],
    activeMapName: 'test-map',
    current,
    currentFocusPoints: 1,
    disciplinedSurvivorAvailable: true,
    setRerollUsedForSave: vi.fn(),
    submitSaveResult: vi.fn(),
    ...overrides,
  });
}

describe('createDisciplinedSurvivorHandler (CLA-087)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(19);
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null });
    getAbilitySaveBonus.mockReturnValue(10);
    getSaveDisadvantage.mockReturnValue(false);
  });

  it('rerolls with the real save bonus — total = die + saveBonus vs DC, not raw d20 + 0', async () => {
    const submitSaveResult = vi.fn();
    await makeHandler({ submitSaveResult })();

    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      promptId: 'p1',
      targetName: 'Disciplined_Monk',
      success: true,
      roll: 19,
      total: 29,
      saveBonus: 10,
      rawRolls: [19, 19],
      mode: 'normal',
      bonusDetail: '(-1 Focus Point)',
      note: 'disciplined_survivor_reroll',
    }));
  });

  it('a mid face (8-18) succeeds thanks to the threaded bonus, not raw d20', async () => {
    rollD20.mockReturnValue(12);
    const submitSaveResult = vi.fn();
    await makeHandler({ submitSaveResult })();

    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      roll: 12,
      total: 22,
      saveBonus: 10,
    }));
  });

  it('threads campaignName/characters into the save-bonus lookup (byte-twin of Fanatical/Indomitable)', async () => {
    await makeHandler()();

    expect(getAbilitySaveBonus).toHaveBeenCalledWith(monkCharacter.computedStats, 'WIS');
    expect(computeAuraBonus).toHaveBeenCalledWith(expect.objectContaining({
      targetName: 'Disciplined_Monk',
      characters: [monkCharacter],
      campaignName: 'test-campaign',
      activeMapName: 'test-map',
    }));
  });

  it('spends exactly 1 focus point', async () => {
    await makeHandler()();

    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', 0, 'test-campaign');
  });

  it('does nothing when unavailable', async () => {
    const submitSaveResult = vi.fn();
    await makeHandler({ disciplinedSurvivorAvailable: false, submitSaveResult })();

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(submitSaveResult).not.toHaveBeenCalled();
  });

  it('byte-shape parity: fanatical focus submits the same reroll fields with its own bonus detail', async () => {
    const submitSaveResult = vi.fn();
    const handler = createFanaticalFocusHandler({
      campaignName: 'test-campaign',
      characters: [monkCharacter],
      activeMapName: 'test-map',
      current,
      rageDamageBonus: 0,
      fanaticalFocusAvailable: true,
      setRerollUsedForSave: vi.fn(),
      submitSaveResult,
    });
    await handler();

    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      promptId: 'p1',
      targetName: 'Disciplined_Monk',
      roll: 19,
      total: 29,
      saveBonus: 10,
      rawRolls: [19, 19],
      mode: 'normal',
      saveType: 'WIS',
      saveDc: 19,
      note: 'fanatical_focus_reroll',
    }));
    expect(addEntry).not.toHaveBeenCalled();
  });
});
