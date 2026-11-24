// @maintained-by-ai
// Condition-lane Results-face payload (improve-condition-aoe-results-face,
// 2026-11-24): the sheet-cast Stinking Cloud chain used to close SILENTLY after
// the last save prompt — handle()'s summary popup was dropped by the chooser
// runner and no `.abjure-result` Results face ever mounted (the damage lane's
// Burning Hands always landed one). handle() now resolves with an
// `{ type: 'aoe_condition_results' }` payload carrying ONE record per selected
// target in the ResultsSummaryModal's row shape:
//   · adjudicated saves → { targetName, success, roll, total, saveBonus,
//     conditionApplied } straight from the save-prompt detail (the SAME numbers
//     the save_result log rows carry — the face's saveEquationText copy must be
//     reconcilable against the ledger);
//   · cast-time immunity skips (6b045026a gate) → an honest { immune: true }
//     record with NO fabricated roll (the creature is never prompted).
// The summary `description` string stays byte-identical to the pre-face law
// (buildStinkingCloudSummary) — only the envelope type changed. Early refusals
// (no combat / no targets) stay plain automation_info notices.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: { set: vi.fn() },
}));

import { handle } from './stinkingCloudHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const campaignName = 'test-campaign';

const playerStats = { name: 'TestWizard', level: 10 };

const action = {
  name: 'Stinking Cloud',
  automation: { type: 'stinking_cloud', saveDc: 15, saveType: 'CON' },
  metaCtx: {},
};

const twoTargetCombat = {
  creatures: [{ name: 'EnemyGoblin' }, { name: 'EnemyOrc' }],
};

describe('stinkingCloudHandler — aoe_condition_results payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(15);
    getCombatSummary.mockReturnValue(null);
    getRuntimeValue.mockReturnValue([]);
  });

  it('carries one equation-ready record per adjudicated target (saved + failed)', async () => {
    getCombatContext.mockResolvedValue(twoTargetCombat);
    let call = 0;
    createSaveListener.mockImplementation(() => {
      call += 1;
      return call === 1
        ? { promptId: 'p1', promise: Promise.resolve({ success: true, roll: 12, saveBonus: 3, total: 15 }) }
        : { promptId: 'p2', promise: Promise.resolve({ success: false, roll: 4, saveBonus: -1, total: 3 }) };
    });

    const result = await handle(action, playerStats, campaignName, null);

    expect(result.payload.type).toBe('aoe_condition_results');
    expect(result.payload.conditionLabel).toBe('Poisoned');
    expect(result.payload.saveDc).toBe(15);
    expect(result.payload.results).toEqual([
      { targetName: 'EnemyGoblin', success: true, roll: 12, total: 15, saveBonus: 3, conditionApplied: false },
      { targetName: 'EnemyOrc', success: false, roll: 4, total: 3, saveBonus: -1, conditionApplied: true },
    ]);
    // The summary copy law is untouched — the face changed, the ledger text did not.
    expect(result.payload.description).toContain('Stinking Cloud affects 1 creature(s).');
  });

  it('reports honest zero-number fields when the save detail omits roll data', async () => {
    getCombatContext.mockResolvedValue(twoTargetCombat);
    createSaveListener.mockReturnValue({
      promptId: 'p',
      promise: Promise.resolve({ success: true }),
    });

    const result = await handle(action, playerStats, campaignName, null);

    expect(result.payload.results).toEqual([
      { targetName: 'EnemyGoblin', success: true, roll: 0, total: 0, saveBonus: 0, conditionApplied: false },
      { targetName: 'EnemyOrc', success: true, roll: 0, total: 0, saveBonus: 0, conditionApplied: false },
    ]);
  });

  it('records cast-time immune skips without a fabricated roll and never prompts them', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'EnemyGoblin', weaknessesAndResistivities: { immunities: ['poison'] } },
        { name: 'EnemyOrc' },
      ],
    });
    createSaveListener.mockReturnValue({
      promptId: 'p2',
      promise: Promise.resolve({ success: false, roll: 2, saveBonus: 0, total: 2 }),
    });

    const result = await handle(action, playerStats, campaignName, null);

    expect(createSaveListener).toHaveBeenCalledTimes(1);
    expect(result.payload.results).toEqual([
      { targetName: 'EnemyGoblin', success: true, immune: true, roll: null, total: 0, saveBonus: 0, conditionApplied: false },
      { targetName: 'EnemyOrc', success: false, roll: 2, total: 2, saveBonus: 0, conditionApplied: true },
    ]);
  });

  it('early refusals stay plain automation_info notices (no empty results face)', async () => {
    getCombatContext.mockResolvedValue(null);

    const result = await handle(action, playerStats, campaignName, null);

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('No creatures in combat');
  });
});
