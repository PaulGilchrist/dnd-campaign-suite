// @improved-by-ai
// CLA-087 regression: Disciplined Survivor reroll must thread the real
// campaignName/characters into doReroll so the save bonus (+10 all-saves-prof
// monk) and aura stacking apply to the rerolled die — not raw d20 + 0.
// Also pins the shared reroll submit contract (payload fields, focus/rage
// resource spend, disadvantage path, unavailable/no-prompt guards) for both
// Disciplined Survivor and Fanatical Focus.
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

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

const monkCharacter = { name: 'Disciplined_Monk', level: 18, computedStats: { level: 18 } };

// Mind Spike: WIS save DC 19. With the monk's +10 all-saves-prof bonus,
// natural 9–18 pass with the bonus threaded but fail as a raw d20 —
// mid rolls discriminate "bonus applied" from "raw d20 + 0".
const basePrompt = {
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

function makeDisciplined(overrides = {}) {
  const submitSaveResult = vi.fn();
  const setRerollUsedForSave = vi.fn();
  const handler = createDisciplinedSurvivorHandler({
    campaignName: CAMPAIGN,
    characters: [monkCharacter],
    activeMapName: MAP,
    current: basePrompt,
    currentFocusPoints: 1,
    disciplinedSurvivorAvailable: true,
    submitSaveResult,
    setRerollUsedForSave,
    ...overrides,
  });
  return { handler, submitSaveResult, setRerollUsedForSave };
}

function makeFanatical(overrides = {}) {
  const submitSaveResult = vi.fn();
  const setRerollUsedForSave = vi.fn();
  const handler = createFanaticalFocusHandler({
    campaignName: CAMPAIGN,
    characters: [monkCharacter],
    activeMapName: MAP,
    current: basePrompt,
    rageDamageBonus: 0,
    fanaticalFocusAvailable: true,
    submitSaveResult,
    setRerollUsedForSave,
    ...overrides,
  });
  return { handler, submitSaveResult, setRerollUsedForSave };
}

describe('createDisciplinedSurvivorHandler (CLA-087)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(19);
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null });
    getAbilitySaveBonus.mockReturnValue(10);
    getSaveDisadvantage.mockReturnValue(false);
  });

  it('rerolls with the threaded save bonus and forwards the full prompt context', async () => {
    rollD20.mockReturnValue(12); // raw 12 fails DC 19 — only the +10 bonus can pass it
    const { handler, submitSaveResult, setRerollUsedForSave } = makeDisciplined();
    await handler();

    expect(setRerollUsedForSave).toHaveBeenCalledWith(true);
    expect(rollD20).toHaveBeenCalledTimes(1); // no disadvantage: one die, replayed as roll2
    expect(submitSaveResult).toHaveBeenCalledTimes(1);
    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      promptId: 'p1',
      targetName: 'Disciplined_Monk',
      roll: 12,
      total: 22,
      saveBonus: 10,
      success: true,
      rawRolls: [12, 12],
      mode: 'normal',
      bonusDetail: '(-1 Focus Point)',
      note: 'disciplined_survivor_reroll',
      saveType: 'WIS',
      saveDc: 19,
      damageFormula: '4d8',
      rawDamage: 14,
      dcSuccess: 'half',
      damageType: 'Psychic',
      sourceName: 'Mind Spike',
      healingName: 'Disciplined Survivor',
      healingNote: 'disciplined_survivor_hp_restore',
    }));
  });

  it('spends exactly one focus point from the current total', async () => {
    const { handler } = makeDisciplined({ currentFocusPoints: 3 });
    await handler();

    // 3 → 2 (not a hardcoded constant, not a 2-point spend)
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', 2, CAMPAIGN);
  });

  it('threads campaign/map/characters into the bonus lookups — right args pay out, wrong args score nothing', async () => {
    // Arg-aware mocks: the bonus is only earned when doReroll passes the
    // genuine character stats, campaign, and map. Any dropped thread drops
    // the total below the DC and flips success — verified by the outcome.
    getAbilitySaveBonus.mockImplementation((stats, saveType) => (
      stats === monkCharacter.computedStats && saveType === 'WIS' ? 10 : 0
    ));
    computeAuraBonus.mockImplementation(async ({ campaignName, activeMapName, targetName, characters }) => (
      campaignName === CAMPAIGN && activeMapName === MAP && targetName === 'Disciplined_Monk'
        && Array.isArray(characters) && characters.some(c => c.name === 'Disciplined_Monk')
        ? { bonus: 2, sourceName: 'Guardian Aura' }
        : { bonus: 0, sourceName: null }
    ));
    rollD20.mockReturnValue(7); // 7 + 10 save + 2 aura = 19 — passes at exactly the DC (>= boundary)
    const { handler, submitSaveResult } = makeDisciplined();
    await handler();

    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      roll: 7,
      saveBonus: 12,
      total: 19,
      success: true,
    }));
  });

  it('submits a failed reroll honestly when the new total is still below the DC', async () => {
    rollD20.mockReturnValue(1); // 1 + 10 + 0 = 11 < 19
    const { handler, submitSaveResult } = makeDisciplined();
    await handler();

    expect(submitSaveResult).toHaveBeenCalledTimes(1);
    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      roll: 1,
      total: 11,
      saveBonus: 10,
      note: 'disciplined_survivor_reroll',
    }));
  });

  it('rolls twice and keeps the lower die when the save has disadvantage', async () => {
    getSaveDisadvantage.mockReturnValue(true);
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(7);
    const { handler, submitSaveResult } = makeDisciplined();
    await handler();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      roll: 7,
      rawRolls: [15, 7],
      mode: 'disadvantage',
      total: 17,
      success: false,
    }));
  });

  it('does nothing when unavailable', async () => {
    const { handler, submitSaveResult, setRerollUsedForSave } =
      makeDisciplined({ disciplinedSurvivorAvailable: false });
    await handler();

    expect(setRerollUsedForSave).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
    expect(submitSaveResult).not.toHaveBeenCalled();
  });

  it('does nothing when there is no active save prompt', async () => {
    const { handler, submitSaveResult, setRerollUsedForSave } =
      makeDisciplined({ current: null });
    await handler();

    expect(setRerollUsedForSave).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(submitSaveResult).not.toHaveBeenCalled();
  });
});

describe('createFanaticalFocusHandler (shared reroll contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(19);
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null });
    getAbilitySaveBonus.mockReturnValue(10);
    getSaveDisadvantage.mockReturnValue(false);
  });

  it('marks its use, threads the rage bonus, and submits the same reroll shape', async () => {
    rollD20.mockReturnValue(12);
    const { handler, submitSaveResult, setRerollUsedForSave } = makeFanatical({ rageDamageBonus: 2 });
    await handler();

    expect(setRerollUsedForSave).toHaveBeenCalledWith(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'fanaticalFocusUsed', true, CAMPAIGN);
    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      promptId: 'p1',
      targetName: 'Disciplined_Monk',
      roll: 12,
      total: 24, // 12 + 10 save bonus + 2 rage damage bonus threaded through doReroll
      saveBonus: 12,
      success: true,
      rawRolls: [12, 12],
      mode: 'normal',
      bonusDetail: '(+2 Fanatical Focus)',
      saveType: 'WIS',
      saveDc: 19,
      note: 'fanatical_focus_reroll',
      healingName: 'Fanatical Focus',
      healingNote: 'fanatical_focus_hp_restore',
    }));
    // Unlike Indomitable, this handler logs downstream via submitSaveResult, not directly.
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does nothing when unavailable', async () => {
    const { handler, submitSaveResult, setRerollUsedForSave } =
      makeFanatical({ fanaticalFocusAvailable: false });
    await handler();

    expect(setRerollUsedForSave).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
    expect(submitSaveResult).not.toHaveBeenCalled();
  });
});
