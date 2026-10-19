// @maintained-by-ai: 2026-10-19
// CLA-120 lane (unit seam, processPotentCantrip): the potent-cantrip miss-half
// formula rides the pre-baked autoDamageFormula — buildPotentMissFormula appends
// the INT term ONLY when '[Empowered Evocation]' is absent (CLA-279 idempotency
// shape). This lane owns formula folding, idempotency and the school gate:
// falsified by a double-fold rolled as '4d10 + 5 [EE] + 5 [EE]' (the CLA-120
// defect) or by any append through the auto-miss roll path.
// Family map: generic potent dispatch (flag false / hit / no formula / auto-miss
// without saveDc gates, stored-vs-fresh half totals, popup reach) runs the REAL
// processPotentCantrip through the full lane in
// useLoggedDiceRollAttack.potent-cantrip.test.js — never re-litigated here.
// Pipeline-side CLA-120 dedupe copies are owned by the services/*cla120* lanes.
// Old→new: t1 formula-only pre-baked → t1 full log+damage bytes, zero re-roll;
// t2 unmarked fold → folded into t2 it.each (same seam, auto-miss roll path);
// t3 school gate → t3, strengthened with roll-path bytes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 22, rolls: [8, 5, 5, 4], modifier: 0 })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(() => Promise.resolve({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasIgnoreResistance: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => Promise.resolve({ finalDamage: 11, newHp: 4 })),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
  hasPotentCantrip: vi.fn(() => true),
  applyMinDamageAdjustment: vi.fn((total) => total),
}));

// Consumer-exact stubs: buildPotentMissFormula reads feature presence and the
// INT modifier; gates false of these are owned by the attack-seam lane.
vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => [{ type: 'empowered_evocation' }]),
  getEmpoweredEvocationIntModifier: vi.fn(() => 5),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { processPotentCantrip } from './attackPostProcessing.js';

const FOLDED = '4d10 + 5 [Empowered Evocation]';

function makeContext(overrides = {}) {
  return {
    name: 'Fire Bolt',
    playerStats: { name: 'DivinationWizard', abilities: [{ name: 'Intelligence', bonus: 5 }] },
    autoDamageFormula: FOLDED,
    autoDamageRollResult: { total: 29, rolls: [8, 6, 6, 4], modifier: 5 },
    autoDamageSchool: 'Evocation',
    damageType: 'Fire',
    saveDc: null,
    ...overrides,
  };
}

function runMiss(overrides = {}) {
  const logEntry = vi.fn();
  const setPopupHtml = vi.fn();
  return processPotentCantrip({
    hit: false,
    isAutoMiss: false,
    targetName: 'NPC 1',
    characterName: 'DivinationWizard',
    campaignName: 'test-campaign',
    characters: [],
    logEntry,
    setPopupHtml,
    ...overrides,
    context: makeContext(overrides.context ?? {}),
  }).then(() => ({ logEntry, setPopupHtml }));
}

describe('processPotentCantrip — CLA-120 miss-half formula folds INT exactly once', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rolled miss reuses the stored damage result — no phantom re-roll, log + applied damage carry the single-term formula', async () => {
    const { logEntry, setPopupHtml } = await runMiss();

    // The CLA-120 phantom roll: with a stored result the engine must NOT
    // re-roll the formula (a re-roll of a double-fold doubled the INT term).
    expect(rollExpression).not.toHaveBeenCalled();

    // App logging mandate: the automation logs exact bytes via logEntry.
    expect(logEntry).toHaveBeenCalledTimes(1);
    expect(logEntry).toHaveBeenCalledWith({
      type: 'roll',
      characterName: 'DivinationWizard',
      rollType: 'cantrip-miss-half-damage',
      name: 'Fire Bolt',
      formula: FOLDED,
      rolls: [8, 6, 6, 4],
      total: 14, // floor(29 / 2)
      modifier: 5,
      damageType: 'Fire',
      targetName: 'NPC 1',
      isPotentCantrip: true,
    });

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget).toHaveBeenCalledWith(
      { creatures: [] },
      'NPC 1',
      14,
      ['Fire'],
      { campaignName: 'test-campaign', characters: [], ignoreResistance: false, attackerName: 'DivinationWizard' }
    );

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'save-damage',
      formula: FOLDED,
      total: 11,
      dcSuccess: 'half',
      isPotentCantrip: true,
    }));
  });

  it.each([
    ['pre-baked autoDamageFormula', FOLDED],
    ['unmarked autoDamageFormula (PASS control — folding must still happen)', '4d10'],
  ])('auto miss with saveDc — %s rolls exactly ONE [Empowered Evocation] term', async (_label, autoDamageFormula) => {
    const { logEntry } = await runMiss({
      isAutoMiss: true,
      context: { autoDamageFormula, saveDc: 18 },
    });

    // Pre-fix CLA-120, the pre-baked leg rolled '4d10 + 5 [EE] + 5 [EE]'.
    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith(FOLDED);

    expect(logEntry).toHaveBeenCalledTimes(1);
    expect(logEntry).toHaveBeenCalledWith(expect.objectContaining({
      rollType: 'cantrip-miss-half-damage',
      formula: FOLDED,
      rolls: [8, 5, 5, 4],
      total: 11, // floor(fresh 22 / 2) — INT counted once in the half total
      isPotentCantrip: true,
    }));
  });

  it('auto miss in a non-evocation school → formula passes through unfolded', async () => {
    const { logEntry } = await runMiss({
      isAutoMiss: true,
      context: { autoDamageFormula: '4d12', autoDamageSchool: 'Necromancy', saveDc: 18 },
    });

    expect(rollExpression).toHaveBeenCalledTimes(1);
    expect(rollExpression).toHaveBeenCalledWith('4d12');
    expect(logEntry).toHaveBeenCalledTimes(1);
    expect(logEntry).toHaveBeenCalledWith(expect.objectContaining({ formula: '4d12', total: 11 }));
  });
});
