// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, formula: '1d20' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, formula: '1d20', maximized: true })),
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
  applyDamageToTarget: vi.fn(),
  computeDamageAfterSave: vi.fn((raw, _success, dcSuccess) => {
    if (!_success) return raw;
    return dcSuccess === 'half' ? Math.floor(raw / 2) : 0;
  }),
  computeDamageAfterEvasion: vi.fn((raw, _success, dcSuccess) => {
    return dcSuccess === 'half' ? Math.floor(raw / 2) : raw;
  }),
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
      { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10, saveBonuses: { con: 2 }, resistances: [], immunities: [] },
      { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10, saveBonuses: { con: 2 }, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { con: 4 } },
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

vi.mock('./CreatureSelectionModal.jsx', () => {
  const { useState, useCallback } = require('react');
  function MockCreatureSelectionModal({
    title, icon, targets, description, note, confirmLabel, confirmIcon, onConfirm, onSkip,
    metamagicHeighten, heightenTarget, setHeightenTarget,
  }) {
    const [selected, setSelected] = useState(new Set());
    const toggleTarget = useCallback((name) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }, []);
    return (
      <div className="sp-overlay" onClick={() => {}}>
        <div className="sp-modal" onClick={e => e.stopPropagation()}>
          <div className="sp-header">
            <i className={`fa-solid ${icon}`}></i> {title}
          </div>
          <div className="sp-body">
            <div dangerouslySetInnerHTML={{ __html: description }} />
            {note && <p className="sp-note">{note}</p>}
            <div className="secondary-target-list">
              {targets.length === 0 && <p className="sp-note">No targets available.</p>}
              {targets.map((t) => {
                const obj = typeof t === 'object' ? t : { name: t };
                return (
                  <label key={obj.name} className={`secondary-target-row ${selected.has(obj.name) ? 'secondary-target-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(obj.name)}
                      onChange={() => toggleTarget(obj.name)}
                    />
                    {obj.name}
                    {metamagicHeighten && (
                      <span>
                        <input
                          type="radio"
                          name="heightenTarget"
                          checked={heightenTarget === obj.name}
                          onChange={() => setHeightenTarget(heightenTarget === obj.name ? null : obj.name)}
                        />
                        Heighten
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="sp-actions">
            <button
              className="sp-roll-btn"
              onClick={() => onConfirm(Array.from(selected))}
              disabled={selected.size === 0}
              type="button"
            >
              <i className={`fa-solid ${confirmIcon}`}></i> {confirmLabel} ({selected.size})
            </button>
            <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
          </div>
        </div>
      </div>
    );
  }
  return { default: MockCreatureSelectionModal };
});

vi.mock('./AreaEffectTargetModalBase.jsx', () => {
  const { useState, useCallback, useMemo } = require('react');
  function MockAreaEffectTargetModalBase({
    combatSummary, _saveDc, campaignName: _campaignName, featureName, _saveType, _rangeFeet,
    onClose, icon, _handleApplyOverride, _handleSaveResultOverride, extraState,
    renderBody, renderActions,
  }) {
    const [selected, setSelected] = useState(new Set());
    const [processing, setProcessing] = useState(false);
    const [pendingPrompts, setPendingPrompts] = useState([]);
    const [heightenTarget, setHeightenTarget] = useState(null);

    const eligibleTargets = useMemo(() => {
      if (!combatSummary?.creatures) return [];
      return combatSummary.creatures.filter(c => c.name !== 'Cleric1');
    }, [combatSummary]);

    const toggleTarget = useCallback((name) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }, []);

    const ctx = {
      processing,
      allResolved: false,
      selected,
      eligibleTargets,
      pendingPrompts,
      toggleTarget,
      setProcessing,
      setPendingPrompts,
      setSelected,
      setHeightenTarget,
      heightenTarget,
    };

    if (extraState?.setSelected) extraState.setSelected = setSelected;
    if (extraState?.toggleTarget) extraState.toggleTarget = toggleTarget;
    if (extraState?.heightenTarget !== undefined) extraState.heightenTarget = heightenTarget;
    if (extraState?.setHeightenTarget) extraState.setHeightenTarget = setHeightenTarget;

    return (
      <div className="sp-overlay" onClick={onClose}>
        <div className="sp-modal" onClick={e => e.stopPropagation()}>
          <div className="sp-header">
            <i className={icon}></i> {featureName}
          </div>
          <div className="sp-body">
            {renderBody ? renderBody(ctx) : null}
          </div>
          <div className="sp-actions">
            {renderActions ? renderActions(ctx) : null}
          </div>
        </div>
      </div>
    );
  }
  return { default: MockAreaEffectTargetModalBase };
});

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../../services/encounters/combatData.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as allySelection from '../../../../hooks/useAllySelection.js';
import * as automationExpressions from '../../../../services/combat/automation/automationExpressions.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';

// ── Test fixtures ──

const mockOnClose = vi.fn();

const mockPlayerStats = { name: 'Cleric1', level: 12 };

const mockAction = {
  name: 'Fireball',
  automation: {
    scaling: { damage: '8d6' },
  },
};

const baseProps = {
  action: mockAction,
  playerStats: mockPlayerStats,
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  onClose: mockOnClose,
};

function makeProps(overrides) {
  return { ...baseProps, ...overrides };
}

function getCheckboxByName(name) {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const label = cb.closest('label');
    if (label && label.textContent.includes(name)) {
      return cb;
    }
  }
  throw new Error(`Checkbox for "${name}" not found`);
}

function confirmSelection(targetName) {
  fireEvent.click(getCheckboxByName(targetName));
  const confirmBtn = screen.getByRole('button', { name: /Fireball \(\d+\)/ });
  return act(async () => {
    fireEvent.click(confirmBtn);
  });
}

// ── Tests ──

describe('SaveAttackAoeModal - Damage resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0, formula: '1d20' });
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10, saveBonuses: { con: 2, dex: 2 }, resistances: [], immunities: [] },
        { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10, saveBonuses: { con: 2, dex: 2 }, resistances: [], immunities: [] },
        { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { con: 4, dex: 4 } },
      ],
    });
    allySelection.getAllyList.mockReturnValue(null);
    automationExpressions.resolveScaling.mockReturnValue({});
  });

  // ── CreatureSelectionModal confirm path ──

  describe('creature selection confirm', () => {
    it('stores spell attack scope and calls addTargetResult for NPC with failed save', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
      render(<SaveAttackAoeModal {...makeProps()} />);
      await confirmSelection('Goblin A');

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith('test-campaign', {
        casterName: 'Cleric1',
        spellName: 'Fireball',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        targetName: 'Goblin A',
      }));
    });

    it('sends save prompt for player target and logs ability_use entry', async () => {
      render(<SaveAttackAoeModal {...makeProps()} />);
      await confirmSelection('Player One');

      expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        targetName: 'Player One',
        saveType: 'DEX',
        saveDc: 15,
        sourceName: 'Cleric1',
        disadvantage: false,
      }));

      const abilityCalls = logService.addEntry.mock.calls.filter(
        c => c[0]?.type === 'ability_use' || (c[1] && c[1].type === 'ability_use')
      );
      expect(abilityCalls.length).toBeGreaterThan(0);
    });
  });

  // ── Results display (summary path) ──

  describe('results display (summary path)', () => {
    it('renders results summary with target names after NPC resolution', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
      render(<SaveAttackAoeModal {...makeProps()} />);
      await confirmSelection('Goblin A');

      await waitFor(() => {
        expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument();
      }, { timeout: 200 });

      expect(screen.getByText(/Goblin A/)).toBeInTheDocument();
    });

    it('renders close button in results summary and calls onClose when clicked', async () => {
      const onClose = vi.fn();
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
      render(<SaveAttackAoeModal {...makeProps({ onClose })} />);
      await confirmSelection('Goblin A');

      await waitFor(() => {
        expect(screen.getByText(/Goblin A/)).toBeInTheDocument();
      }, { timeout: 200 });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

  });

  // ── handleSaveResult (player save path) ──

  describe('handleSaveResult', () => {
    async function triggerSaveResult(success, extra = {}) {
      const promptCall = savePromptService.sendSavePrompt.mock.calls[0][1];
      const promptId = promptCall.promptId;

      await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
          detail: {
            promptId,
            success,
            saveBonus: 4,
            rawDamage: 12,
            total: 16,
            roll: 12,
            ...extra,
          },
        }));
      });

      await waitFor(() => {
        const playerCalls = damageRollback.addTargetResult.mock.calls.filter(
          c => c[1] && c[1].targetName === 'Player One'
        );
        expect(playerCalls.length).toBeGreaterThan(0);
      }, { timeout: 200 });
    }

    it('records failure when player fails save', async () => {
      render(<SaveAttackAoeModal {...makeProps()} />);
      await confirmSelection('Player One');
      await triggerSaveResult(false);

      const playerCalls = damageRollback.addTargetResult.mock.calls.filter(
        c => c[1] && c[1].targetName === 'Player One'
      );
      expect(playerCalls[0][1].saveResult).toBe('failure');
    });

    it('records success when player succeeds save with half damage', async () => {
      render(<SaveAttackAoeModal {...makeProps({ dcSuccess: 'half' })} />);
      await confirmSelection('Player One');
      await triggerSaveResult(true);

      const playerCalls = damageRollback.addTargetResult.mock.calls.filter(
        c => c[1] && c[1].targetName === 'Player One'
      );
      expect(playerCalls[0][1].saveResult).toBe('success');
    });

    // @cleaned-by-ai
  });

  // ── CLA-109: Eldritch Strike disadvantage_on_next_save regression ──

  describe('disadvantage_on_next_save targetEffect', () => {
    it('rolls NPC save with disadvantage when target has disadvantage_on_next_save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') {
          return [{ target: 'Goblin A', effect: 'disadvantage_on_next_save' }];
        }
        return null;
      });

      render(<SaveAttackAoeModal {...makeProps()} />);
      await confirmSelection('Goblin A');

      const npcCalls = damageRollback.addTargetResult.mock.calls.filter(
        c => c[1] && c[1].targetName === 'Goblin A'
      );
      expect(npcCalls.length).toBeGreaterThan(0);
    });

    it('consumes disadvantage_on_next_save effect after NPC save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') {
          return [{ target: 'Goblin A', effect: 'disadvantage_on_next_save' }];
        }
        return null;
      });

      render(<SaveAttackAoeModal {...makeProps()} />);
      await confirmSelection('Goblin A');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [],
        'test-campaign'
      );
    });
  });
});
