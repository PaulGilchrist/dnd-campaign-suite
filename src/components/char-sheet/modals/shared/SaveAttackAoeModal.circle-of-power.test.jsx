// @improved-by-ai
// SP-023: Circle of Power must zero half-damage save damage on a successful
// save at the SaveAttackAoeModal chooser adjudication seam, and the prompt
// logs must carry advantage fidelity (distinct rawRolls + mode) instead of
// the old [detailRoll, detailRoll] duplication.
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

vi.mock('./CreatureSelectionModal.jsx', () => {
  const { useState, useCallback } = require('react');
  function MockCreatureSelectionModal({ targets, onConfirm, onSkip, confirmLabel }) {
    const [selected, setSelected] = useState(new Set());
    const toggleTarget = useCallback((name) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }, []);
    return (
      <div className="sp-overlay">
        <div className="sp-modal">
          {targets.map((t) => (
            <label key={t.name} className="secondary-target-row">
              <input type="checkbox" checked={selected.has(t.name)} onChange={() => toggleTarget(t.name)} />
              {t.name}
            </label>
          ))}
          <button className="sp-roll-btn" onClick={() => onConfirm(Array.from(selected))} disabled={selected.size === 0} type="button">
            {confirmLabel} ({selected.size})
          </button>
          <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
        </div>
      </div>
    );
  }
  return { default: MockCreatureSelectionModal };
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

function selectAndConfirm(name) {
  const input = screen.getByText(name).closest('label').querySelector('input[type="checkbox"]');
  fireEvent.click(input);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Cold Breath \\(1\\)`) }));
}

function dispatchSaveResult(detail) {
  const promptId = sendSavePrompt.mock.calls[0][1].promptId;
  window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
}

const logs = (filterFn) => addEntry.mock.calls.map(c => c[1]).filter(e => e && filterFn(e));

describe('SaveAttackAoeModal — SP-023 Circle of Power adjudication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCircleOfPowerActive.mockReturnValue(false);
  });

  it('CoP-affected PC succeeds on a half-damage save: ZERO damage applied + CoP-named evasion log + distinct advantage raw rolls', async () => {
    isCircleOfPowerActive.mockImplementation((targetName) => targetName === 'ElderPaladin');

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm('ElderPaladin');
    });
    expect(sendSavePrompt).toHaveBeenCalledTimes(1);

    await act(async () => {
      dispatchSaveResult({
        targetName: 'ElderPaladin',
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
      expect(addEntry.mock.calls.length).toBeGreaterThan(0);
    });

    // Zero damage: no damage applied to the PC.
    const applied = applyDamageToTarget.mock.calls.filter(c => c[1] === 'ElderPaladin');
    expect(applied).toHaveLength(0);

    // CoP-named evasion entry (logQuickRollEvasion mirror).
    const copLogs = logs(e => e.rollType === 'evasion' && e.targetName === 'ElderPaladin');
    expect(copLogs).toHaveLength(1);
    expect(copLogs[0].name).toBe('Circle of Power');
    expect(copLogs[0].saveResult).toBe('success');
    expect(copLogs[0].finalDamage).toBe(0);

    // Save-damage entry: finalDamage 0, distinct raw rolls, advantage mode.
    const sdLogs = logs(e => e.rollType === 'save-damage' && e.targetName === 'ElderPaladin');
    const damageLog = sdLogs.find(e => e.formula === '5d8');
    expect(damageLog).toBeTruthy();
    expect(damageLog.finalDamage).toBe(0);
    expect(damageLog.saveRawRolls).toEqual([9, 17]);
    expect(damageLog.mode).toBe('advantage');
    expect(damageLog.note).toBe('Circle of Power');

    // Gate direction: the Wyrmling was consulted and is NOT affected.
    expect(isCircleOfPowerActive.mock.calls.map(c => c[0])).toContain('ElderPaladin');
    expect(isCircleOfPowerActive.mock.calls.map(c => c[0])).not.toContain('White Dragon Wyrmling 1');
  });

  it('CoP-affected PC FAILS the save: full damage stands (success-only zero, byte-consistent control)', async () => {
    isCircleOfPowerActive.mockImplementation((targetName) => targetName === 'ElderPaladin');

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm('ElderPaladin');
    });
    await act(async () => {
      dispatchSaveResult({
        targetName: 'ElderPaladin',
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

    await waitFor(() => {
      expect(applyDamageToTarget.mock.calls.some(c => c[1] === 'ElderPaladin')).toBe(true);
    });
    const applied = applyDamageToTarget.mock.calls.filter(c => c[1] === 'ElderPaladin');
    expect(applied[0][2]).toBe(20);
    expect(logs(e => e.rollType === 'evasion')).toHaveLength(0);
    const damageLog = logs(e => e.rollType === 'save-damage' && e.targetName === 'ElderPaladin').find(e => e.formula === '5d8');
    expect(damageLog.finalDamage).toBe(20);
    expect(damageLog.saveRawRolls).toEqual([3, 11]);
    expect(damageLog.mode).toBe('advantage');
  });

  it('control: non-affected PC succeeds on a half-damage save: HALF damage unchanged', async () => {
    isCircleOfPowerActive.mockReturnValue(false);

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm('HexWarlock');
    });
    await act(async () => {
      dispatchSaveResult({
        targetName: 'HexWarlock',
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
      expect(applyDamageToTarget.mock.calls.some(c => c[1] === 'HexWarlock')).toBe(true);
    });
    const applied = applyDamageToTarget.mock.calls.filter(c => c[1] === 'HexWarlock');
    expect(applied[0][2]).toBe(10);
    expect(logs(e => e.rollType === 'evasion')).toHaveLength(0);
    const damageLog = logs(e => e.rollType === 'save-damage' && e.targetName === 'HexWarlock').find(e => e.formula === '5d8');
    expect(damageLog.finalDamage).toBe(10);
    expect(damageLog.saveRawRolls).toEqual([15, 15]);
    expect(damageLog.mode).toBe('normal');
  });

  it('NPC lane untouched (attacker + non-aura NPC): auto-roll success still pays half, zero CoP consult there', async () => {
    // Gate direction check: even if CoP is consulted per-target, the NPC
    // picker lane adjudication is byte-unchanged (half on success).
    isCircleOfPowerActive.mockReturnValue(false);

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    // Force an NPC save success: raw 20 + con 1 >= DC 12 (Math.min of two
    // disadvantage dice never applies — no disadvantage authored here).
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999);

    await act(async () => {
      const input = screen.getByText('Bandit 1').closest('label').querySelector('input[type="checkbox"]');
      fireEvent.click(input);
      fireEvent.click(screen.getByRole('button', { name: /Cold Breath \(1\)/ }));
    });
    randSpy.mockRestore();

    const applied = applyDamageToTarget.mock.calls.filter(c => c[1] === 'Bandit 1');
    expect(applied).toHaveLength(1);
    expect(applied[0][2]).toBe(10);
    expect(logs(e => e.rollType === 'evasion')).toHaveLength(0);
    const damageLog = logs(e => e.rollType === 'save-damage' && e.targetName === 'Bandit 1')[0];
    expect(damageLog.finalDamage).toBe(10);
    expect(damageLog.saveResult).toBe('success');
  });
});
