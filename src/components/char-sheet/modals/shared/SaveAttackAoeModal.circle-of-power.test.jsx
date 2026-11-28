// @maintained-by-ai 2026-11-27
// SP-023: Circle of Power must zero half-damage save damage on a successful
// save at the SaveAttackAoeModal chooser adjudication seam, and the prompt
// logs must carry advantage fidelity (distinct rawRolls + mode) instead of
// the old [detailRoll, detailRoll] duplication (which stays as the single-
// die normal-mode fallback). The gate is success-only, per-target, and is
// never consulted on the NPC auto-roll lane.
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 20, rolls: [5, 5, 4, 3, 3], modifier: 0, formula: '5d8' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 40, rolls: [], modifier: 0, formula: '5d8', maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((cs, name, dmg) => ({ finalDamage: dmg, newHp: 100 - dmg })),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => {
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  }),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasionActive) => {
    if (evasionActive && dcSuccess === 'half') return success ? 0 : Math.floor(raw / 2);
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  }),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => String(t || '').toUpperCase().slice(0, 3)),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'White Dragon Wyrmling 1', type: 'npc', currentHp: 32, maxHp: 32, saveBonuses: { con: 4 }, resistances: [], immunities: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 }, resistances: [], immunities: [] },
      { name: 'ElderPaladin', type: 'player', currentHp: 224, maxHp: 224, saveBonuses: { con: 10 }, computedStats: { evasionEffects: [] } },
      { name: 'HexWarlock', type: 'player', currentHp: 73, maxHp: 73, saveBonuses: { con: 5 }, computedStats: { evasionEffects: [] } },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/loggedDiceRollUtils.js', () => ({
  getGuardianProtectionAcBonus: vi.fn(() => 0),
  hasSoulstitchProtection: vi.fn(() => false),
  clearSoulstitchStamp: vi.fn(),
}));

vi.mock('../../../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createInteractivePickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createInteractivePickerModal() };
});

// ── Re-import mocked modules ──

import { addEntry } from '../../../../services/ui/logService.js';
import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { isCircleOfPowerActive } from '../../../../services/automation/handlers/buffs/circleOfPowerHandler.js';

const baseAction = { name: 'Cold Breath', automation: {} };
const monsterCaster = { name: 'White Dragon Wyrmling 1', level: 5 };

const baseProps = {
  action: baseAction,
  playerStats: monsterCaster,
  campaignName: 'test-campaign',
  damage: '5d8',
  damageType: 'Cold',
  saveType: 'Constitution',
  saveDc: 12,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

async function renderAndSelect(...names) {
  await act(async () => {
    render(<SaveAttackAoeModal {...baseProps} />);
  });
  await act(async () => {
    for (const name of names) {
      fireEvent.click(screen.getByText(name).closest('label').querySelector('input[type="checkbox"]'));
    }
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Cold Breath \\(${names.length}\\)`) }));
  });
}

function dispatchSaveResult(targetName, detail) {
  const call = sendSavePrompt.mock.calls.find(c => c[1].targetName === targetName);
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId: call[1].promptId, targetName, ...detail },
  }));
}

const logs = (filterFn) => addEntry.mock.calls.map(c => c[1]).filter(e => e && filterFn(e));
const damageLog = (targetName) => logs(e => e.rollType === 'save-damage' && e.targetName === targetName).find(e => e.formula === '5d8');
const appliedDamage = (targetName) => applyDamageToTarget.mock.calls.filter(c => c[1] === targetName).map(c => c[2]);

describe('SaveAttackAoeModal — SP-023 Circle of Power adjudication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCircleOfPowerActive.mockReturnValue(false);
  });

  it('CoP-affected PC succeeds on a half-damage save: ZERO damage applied + CoP-named evasion log + distinct advantage raw rolls', async () => {
    isCircleOfPowerActive.mockImplementation((targetName) => targetName === 'ElderPaladin');

    await renderAndSelect('ElderPaladin');
    expect(sendSavePrompt).toHaveBeenCalledTimes(1);

    await act(async () => {
      dispatchSaveResult('ElderPaladin', {
        success: true,
        roll: 17,
        rawRolls: [9, 17],
        mode: 'advantage',
        saveBonus: 10,
        saveType: 'Constitution',
        saveDc: 12,
        dcSuccess: 'half',
        rawDamage: 20,
        total: 27,
      });
    });
    await waitFor(() => {
      expect(logs(e => e.rollType === 'save-damage' && e.targetName === 'ElderPaladin').length).toBeGreaterThan(0);
    });

    // Zero damage: no damage applied to the PC.
    expect(appliedDamage('ElderPaladin')).toHaveLength(0);

    // CoP-named evasion entry (logQuickRollEvasion mirror).
    const copLogs = logs(e => e.rollType === 'evasion' && e.targetName === 'ElderPaladin');
    expect(copLogs).toHaveLength(1);
    expect(copLogs[0]).toMatchObject({
      name: 'Circle of Power',
      saveResult: 'success',
      finalDamage: 0,
    });

    // Save-damage entry: finalDamage 0, distinct raw rolls, advantage mode.
    const entry = damageLog('ElderPaladin');
    expect(entry).toBeTruthy();
    expect(entry).toMatchObject({
      finalDamage: 0,
      saveResult: 'success',
      saveRawRolls: [9, 17],
      mode: 'advantage',
      note: 'Circle of Power',
    });

    // The gate was consulted for the prompt's target (aura stamp lives on the PC).
    expect(isCircleOfPowerActive.mock.calls.map(c => c[0])).toContain('ElderPaladin');
  });

  it('one AoE, two PCs: CoP-affected FAIL pays full, unaffected SUCCESS pays half with single-die [roll, roll] normal-mode fallback', async () => {
    // Negative controls through the SAME adjudication pass: the aura covers
    // only ElderPaladin, whose failed save must still pay full (success-only
    // zero), while out-of-aura HexWarlock's successful save pays the normal
    // half rule and its one-dice prompt log duplicates [roll, roll] under
    // mode 'normal' (fidelity fallback; distinct two-dice rawRolls pass
    // through in the test above).
    isCircleOfPowerActive.mockImplementation((targetName) => targetName === 'ElderPaladin');

    await renderAndSelect('ElderPaladin', 'HexWarlock');
    expect(sendSavePrompt).toHaveBeenCalledTimes(2);

    await act(async () => {
      dispatchSaveResult('ElderPaladin', {
        success: false,
        roll: 3,
        rawRolls: [3, 11],
        mode: 'advantage',
        saveBonus: 10,
        saveType: 'Constitution',
        saveDc: 12,
        dcSuccess: 'half',
        rawDamage: 20,
        total: 13,
      });
    });
    await act(async () => {
      dispatchSaveResult('HexWarlock', {
        success: true,
        roll: 15,
        rawRolls: [15],
        mode: 'normal',
        saveBonus: 5,
        saveType: 'Constitution',
        saveDc: 12,
        dcSuccess: 'half',
        rawDamage: 20,
        total: 20,
      });
    });
    await waitFor(() => {
      expect(logs(e => e.rollType === 'save-damage' && e.targetName === 'HexWarlock').length).toBeGreaterThan(0);
    });

    expect(appliedDamage('ElderPaladin')).toEqual([20]);
    expect(appliedDamage('HexWarlock')).toEqual([10]);
    expect(logs(e => e.rollType === 'evasion')).toHaveLength(0);

    const failedLog = damageLog('ElderPaladin');
    expect(failedLog).toMatchObject({ finalDamage: 20, saveRawRolls: [3, 11], mode: 'advantage' });
    const halfLog = damageLog('HexWarlock');
    expect(halfLog).toMatchObject({ finalDamage: 10, saveRawRolls: [15, 15], mode: 'normal' });
  });

  it('NPC lane never folds Circle of Power: aura TRUE everywhere, auto-roll success still pays HALF and the gate is never consulted there', async () => {
    // Aura-true everywhere is the load-bearing setup: the NPC picker lane
    // (resolveNpcTarget) must never consult the CoP gate, so a forced NPC
    // save success pays the normal half-rule byte-unchanged (SP-023).
    isCircleOfPowerActive.mockReturnValue(true);

    // Force an NPC save success: raw 20 + con 1 >= DC 12 (Math.min of two
    // disadvantage dice never applies — no disadvantage authored here).
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    await renderAndSelect('Bandit 1');
    randSpy.mockRestore();

    expect(appliedDamage('Bandit 1')).toEqual([10]);
    expect(logs(e => e.rollType === 'evasion')).toHaveLength(0);
    // The aura gate must NEVER be consulted on the NPC auto-roll lane.
    expect(isCircleOfPowerActive.mock.calls.map(c => c[0])).not.toContain('Bandit 1');
    const entry = logs(e => e.rollType === 'save-damage' && e.targetName === 'Bandit 1')[0];
    expect(entry).toMatchObject({ finalDamage: 10, saveResult: 'success' });
  });
});
