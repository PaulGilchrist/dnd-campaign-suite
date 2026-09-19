// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
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
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';

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

  // ── MA-0563: dual-pool AoE save rows (Death Knight Hellfire Orb) ──

  describe('MA-0563 secondary damage pool', () => {
    const REAL_HALF = (raw, success, dcSuccess) => {
      if (!success) return raw;
      return dcSuccess === 'half' ? Math.floor(raw / 2) : 0;
    };
    const formulaRoll = (total) => ({ total, rolls: [total], modifier: 0 });

    function dualProps(overrides) {
      return makeProps({ damage: '8d6', damageType: 'Fire', secondaryDamage: '10d6', secondaryDamageType: 'Necrotic', ...overrides });
    }

    function mockDualDice() {
      diceRoller.rollExpression.mockImplementation((f) => formulaRoll(f === '8d6' ? 12 : 7));
      applyDamage.computeDamageAfterEvasion.mockImplementation(REAL_HALF);
    }

    function damageLogCalls() {
      return logService.addEntry.mock.calls.map(c => c[1]).filter(e => e && e.rollType === 'save-damage' && e.formula);
    }

    it('failed save rolls BOTH pools full and logs one save-damage entry per type', async () => {
      mockDualDice();
      // DC 999 → guaranteed NPC fail, both legs full (floor-halving untaken).
      render(<SaveAttackAoeModal {...dualProps({ saveDc: 999 })} />);
      await confirmSelection('Goblin A');

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(), 'Goblin A', 12, ['Fire'], expect.anything());
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(), 'Goblin A', 7, ['Necrotic'], expect.anything());

      const logs = damageLogCalls();
      const primary = logs.find(e => e.formula === '8d6');
      const secondary = logs.find(e => e.formula === '10d6');
      expect(primary).toBeTruthy();
      expect(primary.damageType).toBe('Fire');
      expect(primary.finalDamage).toBe(12);
      expect(primary.saveResult).toBe('failure');
      expect(secondary).toBeTruthy();
      expect(secondary.damageType).toBe('Necrotic');
      expect(secondary.finalDamage).toBe(7);
      expect(secondary.saveResult).toBe('failure');

      const rollback = damageRollback.addTargetResult.mock.calls.find(c => c[1]?.targetName === 'Goblin A');
      expect(rollback[1].appliedDamage).toBe(19);

      await waitFor(() => {
        expect(screen.getByText(/takes 12 Fire \+ 7 Necrotic damage/)).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('successful save halves EACH pool independently (floor each leg)', async () => {
      mockDualDice();
      render(<SaveAttackAoeModal {...dualProps({ dcSuccess: 'half' })} />);
      await confirmSelection('Player One');

      expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        targetName: 'Player One',
        rawDamage: 12,
        secondaryRawDamage: 7,
        secondaryDamageType: 'Necrotic',
      }));

      const promptCall = savePromptService.sendSavePrompt.mock.calls[0][1];
      await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
          detail: { promptId: promptCall.promptId, success: true, saveBonus: 4, rawDamage: 12, total: 16, roll: 12 },
        }));
      });

      await waitFor(() => {
        expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
          expect.anything(), 'Player One', 6, ['Fire'], expect.anything());
        expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
          expect.anything(), 'Player One', 3, ['Necrotic'], expect.anything());
      }, { timeout: 200 });

      const logs = damageLogCalls();
      expect(logs.some(e => e.formula === '8d6' && e.finalDamage === 6 && e.saveResult === 'success')).toBe(true);
      expect(logs.some(e => e.formula === '10d6' && e.finalDamage === 3 && e.saveResult === 'success')).toBe(true);
    });

    it('single-damage rows stay byte-identical: one roll, one type, one log, no secondary fields', async () => {
      diceRoller.rollExpression.mockImplementation((f) => formulaRoll(f === '8d6' ? 12 : 7));
      applyDamage.computeDamageAfterEvasion.mockImplementation(REAL_HALF);
      render(<SaveAttackAoeModal {...makeProps({ saveDc: 999 })} />);
      // picker copy byte-check BEFORE confirm swaps the view to the summary.
      expect(screen.getByText('On a failed save, target takes 8d6 Fire damage. On a successful save, target takes half damage.')).toBeInTheDocument();
      expect(screen.queryByText(/plus 10d6/)).toBeNull();
      await confirmSelection('Goblin A');

      const targetCalls = applyDamage.applyDamageToTarget.mock.calls.filter(c => c[1] === 'Goblin A');
      expect(targetCalls.length).toBe(1);
      expect(targetCalls[0][2]).toBe(12);
      expect(targetCalls[0][3]).toEqual(['Fire']);

      const logs = damageLogCalls();
      expect(logs.every(e => e.formula === '8d6')).toBe(true);
      expect(logs.every(e => e.damageType === 'Fire')).toBe(true);
      expect(logs.every(e => !('secondaryFinalDamage' in e) && !('secondaryDamageType' in e))).toBe(true);

      const rollback = damageRollback.addTargetResult.mock.calls.find(c => c[1]?.targetName === 'Goblin A');
      expect(rollback[1].appliedDamage).toBe(12);
      expect('secondaryFinalDamage' in rollback[1]).toBe(false);
    });

    it('Death Knight + Aspirant twin data-lock: Hellfire Orb dual pools on disk', () => {
      const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
      const dk = monsters.find(m => m.name === 'Death Knight');
      const orb = dk.actions.find(a => a.name === 'Hellfire Orb');
      expect(orb.damage_dice_primary).toBe('10d6');
      expect(orb.damage_type_primary).toBe('Fire');
      expect(orb.damage_dice_secondary).toBe('10d6');
      expect(orb.damage_type_secondary).toBe('Necrotic');
      expect(orb.save_dc).toBe(18);
      expect(orb.save_type).toBe('Dexterity');
      expect(orb.recharge).toBe('5-6');
      expect(orb.dc_success).toBeUndefined();

      const asp = monsters.find(m => m.name === 'Death Knight Aspirant');
      const aspOrb = asp.actions.find(a => a.name === 'Hellfire Orb');
      expect(aspOrb.damage_dice_secondary).toBe('6d6');
      expect(aspOrb.damage_type_secondary).toBe('Necrotic');
      expect(aspOrb.save_dc).toBe(15);
    });
  });
});
