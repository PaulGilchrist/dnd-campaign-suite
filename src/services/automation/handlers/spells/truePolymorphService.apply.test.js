// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(() => Promise.resolve()) },
}));

vi.mock('./truePolymorphHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('./polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(),
}));

import { applyTruePolymorph } from './truePolymorphService.js';
import { handle as runTruePolymorphHandler } from './truePolymorphHandler.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: { CON: { bonus: 2 } },
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

describe('truePolymorphService.applyTruePolymorph', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for non-true-polymorph spells', async () => {
    const result = await applyTruePolymorph({ name: 'Fireball' }, {}, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
    expect(runTruePolymorphHandler).not.toHaveBeenCalled();
  });

  it('SP-124: guards missing spell (no TypeError) when confirm wiring passes undefined', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await applyTruePolymorph(undefined, {}, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
    expect(runTruePolymorphHandler).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('dispatches to the handler and returns its result', async () => {
    const popup = { type: 'popup', payload: { type: 'true_polymorph_select', targetName } };
    runTruePolymorphHandler.mockResolvedValue(popup);

    const spell = { name: 'True Polymorph', level: 9 };
    const metaCtx = { truePolymorphTarget: targetName, spellSaveDc: 16, slotLevel: 9 };
    const result = await applyTruePolymorph(spell, metaCtx, makePlayerStats(), campaignName, null);

    expect(runTruePolymorphHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'True Polymorph',
        automation: expect.objectContaining({
          type: 'true_polymorph',
          saveDc: 16,
          saveType: 'WIS',
          mode: undefined,
        }),
        spell,
        spellSlotLevel: 9,
      }),
      expect.anything(),
      campaignName,
      null,
    );
    expect(result).toBe(popup);
  });

  it('uses proficiency-based DC when spellSaveDc is not provided', async () => {
    runTruePolymorphHandler.mockResolvedValue({ type: 'popup', payload: {} });

    const spell = { name: 'True Polymorph', level: 9 };
    const playerStats = makePlayerStats({ proficiency: 4, spellAbilities: null });
    await applyTruePolymorph(spell, {}, playerStats, campaignName, null);

    expect(runTruePolymorphHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: expect.objectContaining({ saveDc: 12 }),
      }),
      expect.anything(),
      campaignName,
      null,
    );
  });

  it('returns null when the handler throws', async () => {
    runTruePolymorphHandler.mockRejectedValue(new Error('boom'));

    const result = await applyTruePolymorph(
      { name: 'True Polymorph', level: 9 },
      {},
      makePlayerStats(),
      campaignName,
      null,
    );

    expect(result).toBeNull();
  });

  it('passes the mode from metaCtx', async () => {
    runTruePolymorphHandler.mockResolvedValue({ type: 'popup', payload: {} });

    const spell = { name: 'True Polymorph' };
    const metaCtx = { truePolymorphPath: 'object_into_creature' };
    await applyTruePolymorph(spell, metaCtx, makePlayerStats(), campaignName, null);

    expect(runTruePolymorphHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: expect.objectContaining({ mode: 'object_into_creature' }),
      }),
      expect.anything(),
      campaignName,
      null,
    );
  });
});
