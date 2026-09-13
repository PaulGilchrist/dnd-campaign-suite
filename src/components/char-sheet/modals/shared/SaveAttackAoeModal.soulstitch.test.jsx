// @improved-by-ai
// CLA-321: SaveAttackAoeModal must enforce the Soulstitch Spells stamp on the live sheet AoE path.
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 20, rolls: [20], modifier: 0, formula: '8d6' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 20, rolls: [20], modifier: 0, formula: '8d6', maximized: true })),
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
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 20, newHp: 12 })),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, saveBonuses: { dex: 1 }, resistances: [], immunities: [] },
      { name: 'Zombie 1', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 3 } },
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
  hasSoulstitchProtection: vi.fn(),
  clearSoulstitchStamp: vi.fn(),
}));

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
import { hasSoulstitchProtection, clearSoulstitchStamp } from '../../../../hooks/combat/loggedDiceRollUtils.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';

const baseAction = { name: 'Fireball', automation: {} };
const basePlayerStats = { name: 'DivinationWizard', level: 20 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 17,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function selectAndConfirm(names) {
  for (const name of names) {
    const input = screen.getByText(name).closest('label').querySelector('input[type="checkbox"]');
    fireEvent.click(input);
  }
  fireEvent.click(screen.getByRole('button', { name: /Fireball/ }));
}

function soulstitchLogCalls() {
  return addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.rollType === 'save-damage' && String(e.name).includes('(Soulstitch)'));
}

describe('SaveAttackAoeModal — CLA-321 Soulstitch enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSoulstitchProtection.mockReturnValue(false);
  });

  it('NPC branch: chosen creature auto-succeeds with 0 damage and skips the save roll and damage apply', async () => {
    hasSoulstitchProtection.mockImplementation((targetName) => targetName === 'Thug 1');

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm(['Thug 1', 'Zombie 1']);
    });

    const autoLogs = soulstitchLogCalls();
    expect(autoLogs).toHaveLength(1);
    expect(autoLogs[0].targetName).toBe('Thug 1');
    expect(autoLogs[0].saveResult).toBe('soulstitch_auto_success');
    expect(autoLogs[0].finalDamage).toBe(0);

    const appliedTargets = applyDamageToTarget.mock.calls.map(c => c[1]);
    expect(appliedTargets).not.toContain('Thug 1');
    expect(appliedTargets).toContain('Zombie 1');

    const autoResults = addTargetResult.mock.calls.map(c => c[1]).filter(r => r.targetName === 'Thug 1');
    expect(autoResults[0].saveResult).toBe('soulstitch_auto_success');
    expect(autoResults[0].appliedDamage).toBe(0);
  });

  it('NPC branch: unchosen creatures still roll normally and take damage', async () => {
    hasSoulstitchProtection.mockImplementation((targetName) => targetName === 'Thug 1');

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm(['Thug 1', 'Zombie 1']);
    });

    const normalLogs = addEntry.mock.calls
      .map(c => c[1])
      .filter(e => e && e.rollType === 'save-damage' && e.targetName === 'Zombie 1');
    expect(normalLogs).toHaveLength(1);
    expect(normalLogs[0].saveResult).not.toBe('soulstitch_auto_success');
    expect(normalLogs[0].finalDamage).toBeGreaterThan(0);
  });

  it('consumes the stamp after all saves resolve', async () => {
    hasSoulstitchProtection.mockImplementation((targetName) => targetName === 'Thug 1');

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm(['Thug 1']);
    });

    expect(clearSoulstitchStamp).toHaveBeenCalledTimes(1);
    expect(clearSoulstitchStamp).toHaveBeenCalledWith('DivinationWizard', 'test-campaign');
  });

  it('PC branch: chosen player auto-resolves without a save prompt and takes no damage', async () => {
    hasSoulstitchProtection.mockImplementation((targetName) => targetName === 'Player One');

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm(['Player One']);
    });

    expect(sendSavePrompt).not.toHaveBeenCalled();

    const autoLogs = soulstitchLogCalls();
    expect(autoLogs).toHaveLength(1);
    expect(autoLogs[0].targetName).toBe('Player One');
    expect(autoLogs[0].saveResult).toBe('soulstitch_auto_success');
    expect(autoLogs[0].finalDamage).toBe(0);
  });

  it('PC prompt branch: a soulstitch-chosen target that resolves via save-result is forced to auto-success 0 damage', async () => {
    // Not protected during the resolve loop → prompt is sent for Player One.
    hasSoulstitchProtection.mockReturnValue(false);

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm(['Player One']);
    });
    expect(sendSavePrompt).toHaveBeenCalledTimes(1);

    // Stamp applied mid-cast (chooser re-confirm); the modal-local handler must enforce it.
    hasSoulstitchProtection.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: {
          promptId: sendSavePrompt.mock.calls[0][1].promptId,
          targetName: 'Player One',
          success: false,
          roll: 3,
          total: 6,
          saveBonus: 3,
          saveType: 'DEX',
          saveDc: 17,
          dcSuccess: 'half',
          rawDamage: 20,
        },
      }));
    });

    await waitFor(() => {
      const autoLogs = soulstitchLogCalls().filter(e => e.targetName === 'Player One');
      expect(autoLogs.length).toBeGreaterThan(0);
      expect(autoLogs[0].saveResult).toBe('soulstitch_auto_success');
    });
    const applied = applyDamageToTarget.mock.calls.filter(c => c[1] === 'Player One');
    expect(applied.length).toBe(0);
  });

  it('result popup shows the soulstitch row for the chosen creature', async () => {
    hasSoulstitchProtection.mockImplementation((targetName) => targetName === 'Thug 1');

    await act(async () => {
      render(<SaveAttackAoeModal {...baseProps} />);
    });
    await act(async () => {
      selectAndConfirm(['Thug 1']);
    });

    await waitFor(() => {
      expect(screen.getByText(/Soulstitch — automatically succeeds, takes no damage/)).toBeInTheDocument();
    });
  });
});
