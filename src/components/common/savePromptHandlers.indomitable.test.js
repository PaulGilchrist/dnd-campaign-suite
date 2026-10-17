// @maintained-by-ai
// @improved-by-ai
// CLA-195 regression: createIndomitableHandler must consume exactly one use
// (indomitableUses), submit the reroll with the +fighter level bonus threaded
// through the full save pipeline (save bonus + aura + Indomitable bonus), and
// log each use to the campaign log. Also pins the reroll submit contract for
// Indomitable: pass/fail honesty, disadvantage path, and the unavailable /
// at-max / no-prompt guards.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createIndomitableHandler } from './savePromptHandlers.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { getSaveDisadvantage } from './savePromptUtils.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 5),
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
const FIGHTER = { name: 'EvasiveFighter', level: 18, computedStats: { level: 18 } };
const REROLL_BONUS = 18; // fighter level bonus for Indomitable

// WIS save DC 13. Low natural rolls fail on the die alone — only the
// threaded bonuses can flip them to a success, discriminating "bonus
// applied" from "raw d20 + 0".
const basePrompt = {
  promptId: 'p1',
  targetName: 'EvasiveFighter',
  saveType: 'WIS',
  saveDc: 13,
  dcSuccess: 'half',
  rawDamage: 10,
  damageFormula: '2d6',
  damageType: 'Lightning',
  sourceName: 'Gust of Wind',
};

function makeIndomitable(overrides = {}) {
  const submitSaveResult = vi.fn();
  const setRerollUsedForSave = vi.fn();
  const handler = createIndomitableHandler({
    campaignName: CAMPAIGN,
    characters: [FIGHTER],
    activeMapName: null,
    current: basePrompt,
    indomitableAvailable: true,
    currentUses: 0,
    maxUses: 3,
    rerollBonus: REROLL_BONUS,
    submitSaveResult,
    setRerollUsedForSave,
    ...overrides,
  });
  return { handler, submitSaveResult, setRerollUsedForSave };
}

describe('createIndomitableHandler (CLA-195)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(15);
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: null });
    getAbilitySaveBonus.mockReturnValue(5);
    getSaveDisadvantage.mockReturnValue(false);
  });

  it('consumes exactly one use and locks the reroll UI', async () => {
    const { handler, submitSaveResult, setRerollUsedForSave } = makeIndomitable({ currentUses: 1 });
    await handler();

    expect(setRerollUsedForSave).toHaveBeenCalledWith(true);
    // 1 → 2: derived from currentUses, not a hardcoded constant
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'indomitableUses', 2, CAMPAIGN);
    expect(submitSaveResult).toHaveBeenCalledTimes(1);
  });

  it('submits the reroll with save bonus, aura, and +fighter level bonus all applied', async () => {
    // Arg-aware mocks: bonuses are only earned when doReroll threads the
    // genuine character stats, campaign, and map. Any dropped arg drops the
    // total below DC 13 and flips success — verified by the outcome.
    getAbilitySaveBonus.mockImplementation((stats, saveType) => (
      stats === FIGHTER.computedStats && saveType === 'WIS' ? 5 : 0
    ));
    computeAuraBonus.mockImplementation(async ({ campaignName, targetName, characters }) => (
      campaignName === CAMPAIGN && targetName === 'EvasiveFighter'
        && Array.isArray(characters) && characters.some(c => c.name === 'EvasiveFighter')
        ? { bonus: 2, sourceName: 'Guardian Aura' }
        : { bonus: 0, sourceName: null }
    ));
    rollD20.mockReturnValue(1); // 1 + 5 save + 2 aura + 18 Indomitable = 26 ≥ 13
    const { handler, submitSaveResult } = makeIndomitable();
    await handler();

    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      promptId: 'p1',
      targetName: 'EvasiveFighter',
      roll: 1,
      total: 26,
      saveBonus: 25,
      success: true,
      rawRolls: [1, 1],
      mode: 'normal',
      bonusDetail: '(+18 Indomitable)',
      note: 'indomitable_reroll',
      saveType: 'WIS',
      saveDc: 13,
      damageFormula: '2d6',
      damageType: 'Lightning',
      rawDamage: 10,
      dcSuccess: 'half',
      sourceName: 'Gust of Wind',
      healingName: 'Indomitable',
      healingNote: 'indomitable_hp_restore',
    }));
  });

  it('submits a failed reroll honestly but still consumes the use and logs', async () => {
    // Force a fail: with rerollBonus 0, 1 + 5 save + 0 aura = 6 < DC 13.
    rollD20.mockReturnValue(1);
    const { handler, submitSaveResult } = makeIndomitable({ rerollBonus: 0 });
    await handler();

    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      roll: 1,
      total: 6,
      note: 'indomitable_reroll',
    }));
    // A wasted reroll still spends the use...
    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'indomitableUses', 1, CAMPAIGN);
    // ...and still reaches the campaign log.
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'ability_use',
      characterName: 'EvasiveFighter',
      abilityName: 'Indomitable',
    }));
  });

  it('rolls twice and keeps the lower die when the save has disadvantage', async () => {
    getSaveDisadvantage.mockReturnValue(true);
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(7);
    const { handler, submitSaveResult } = makeIndomitable();
    await handler();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(submitSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      roll: 7,
      rawRolls: [15, 7],
      mode: 'disadvantage',
      total: 30, // 7 + 5 save + 0 aura + 18 Indomitable
      success: true,
    }));
  });

  it('logs each use with the running total and bonus in the description', async () => {
    const { handler } = makeIndomitable({ currentUses: 1, maxUses: 3 });
    await handler();

    expect(addEntry).toHaveBeenCalledTimes(1);
    const [campaign, entry] = addEntry.mock.calls[0];
    expect(campaign).toBe(CAMPAIGN);
    expect(entry).toMatchObject({
      type: 'ability_use',
      characterName: 'EvasiveFighter',
      abilityName: 'Indomitable',
    });
    expect(entry.description).toContain('EvasiveFighter');
    expect(entry.description).toContain('WIS');
    expect(entry.description).toContain('18');
    expect(entry.description).toContain('2/3'); // uses consumed after this one
    expect(typeof entry.timestamp).toBe('number');
  });

  it('treats a missing maxUses as one use per rest', async () => {
    const { handler, submitSaveResult } = makeIndomitable({ maxUses: 0 });
    await handler();

    expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'indomitableUses', 1, CAMPAIGN);
    expect(submitSaveResult).toHaveBeenCalledTimes(1);

    const atOne = makeIndomitable({ maxUses: 0, currentUses: 1 });
    await atOne.handler();

    expect(setRuntimeValue).toHaveBeenCalledTimes(1); // not consumed a second time
    expect(atOne.submitSaveResult).not.toHaveBeenCalled();
  });

  it('does nothing when the feature is unavailable', async () => {
    const { handler, submitSaveResult, setRerollUsedForSave } =
      makeIndomitable({ indomitableAvailable: false, currentUses: 0 });
    await handler();

    expect(setRerollUsedForSave).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(rollD20).not.toHaveBeenCalled();
    expect(submitSaveResult).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does nothing when at or over max uses — never consumes or submits', async () => {
    const atMax = makeIndomitable({ currentUses: 3, maxUses: 3 });
    await atMax.handler();

    expect(atMax.submitSaveResult).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();

    const overMax = makeIndomitable({ currentUses: 5, maxUses: 3 });
    await overMax.handler();

    expect(overMax.submitSaveResult).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does nothing when there is no active save prompt', async () => {
    const { handler, submitSaveResult, setRerollUsedForSave } =
      makeIndomitable({ current: null });
    await handler();

    expect(setRerollUsedForSave).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(submitSaveResult).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
