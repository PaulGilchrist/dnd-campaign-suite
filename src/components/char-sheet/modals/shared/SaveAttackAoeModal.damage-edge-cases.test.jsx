// @maintained-by-ai
// Damage-resolution edge cases on the SaveAttackAoeModal picker lane.
// Family role: Careful Spell damage-zeroing on both resolve branches —
// the NPC auto-roll lane (save still fails, damage folds to zero, no apply,
// no damage log) and the PC prompt lane (protected PC is auto-resolved,
// never prompted; unprotected PC still gets its prompt with full raw damage).
// Multi-target processing and per-target rollback rows ride test 1.
// Plain fail-full / success-half math lives in damage-resolution /
// monster-cone siblings — not re-asserted here.
//
// Determinism without Math.random: DC 999 is an unconditional NPC fail
// (computeNpcSave's 2-draws-per-NPC seam resolves identically for any dice).
// Picker-lane tests use the REAL CreatureSelectionModal (proven inert in
// SaveAttackAoeModal.creature-selection.test.jsx — no campaignName/attackerName
// passed, so its overlay lookup early-returns). AreaEffectTargetModalBase is
// never mounted here (requires targetName 'overlay-…'); its lane is
// SaveAttackAoeModal.overlay.test.jsx.

// ── Mocked modules (data seams only) ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 12, rolls: [12], modifier: 0, formula: '8d6' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 12, rolls: [12], modifier: 0, formula: '8d6', maximized: true })),
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
  // Honest half-on-save semantics (fail pays full).
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
      { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
      { name: 'Player Two', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
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

// ── Re-import mocked modules ──

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

import * as allySelection from '../../../../hooks/useAllySelection.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as logService from '../../../../services/ui/logService.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Fireball', automation: { scaling: { damage: '8d6' } } },
  playerStats: { name: 'Cleric1', level: 12 },
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...overrides };
}

function checkboxFor(name) {
  const row = [...document.querySelectorAll('.secondary-target-row')]
    .find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

function confirmPicked(expectedCount) {
  const confirmBtn = screen.getByRole('button', { name: new RegExp(`Fireball \\(${expectedCount}\\)`) });
  return act(async () => {
    fireEvent.click(confirmBtn);
  });
}

function rollbackRow(targetName) {
  return damageRollback.addTargetResult.mock.calls
    .map(c => c[1])
    .find(r => r && r.targetName === targetName);
}

function saveDamageLogs() {
  return logService.addEntry.mock.calls.map(c => c[1]).filter(e => e && e.rollType === 'save-damage');
}

// ── Tests ──

describe('SaveAttackAoeModal - Damage resolution edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0, formula: '8d6' });
    allySelection.getAllyList.mockReturnValue(null);
  });

  it('Careful Spell: every selected NPC still rolls and gets its own rollback row — protected ally takes ZERO, unprotected target pays FULL', async () => {
    allySelection.getAllyList.mockReturnValue(['Goblin B']);

    // DC 999: both saves fail regardless of dice — RNG seam irrelevant.
    render(<SaveAttackAoeModal {...makeProps({ metamagicCareful: true, saveDc: 999 })} />);
    expect(allySelection.getAllyList).toHaveBeenCalledWith('Cleric1');
    expect(checkboxFor('Goblin B').closest('.secondary-target-row').textContent).toContain('✓ Careful Spell protected');
    expect(checkboxFor('Goblin A').closest('.secondary-target-row').textContent).not.toContain('Careful Spell');

    fireEvent.click(checkboxFor('Goblin A'));
    fireEvent.click(checkboxFor('Goblin B'));
    await confirmPicked(2);

    // Only the unprotected target is damaged: full 12 Fire, exactly one apply.
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin A', 12, ['Fire'], expect.anything());

    // Both targets processed with their own rollback row: same failed save, different damage.
    expect(rollbackRow('Goblin A')).toMatchObject({ saveResult: 'failure', appliedDamage: 12 });
    expect(rollbackRow('Goblin B')).toMatchObject({ saveResult: 'failure', appliedDamage: 0 });

    // Damage log per applied target only — the zeroed leg never logs damage.
    const logs = saveDamageLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]).toMatchObject({ targetName: 'Goblin A', finalDamage: 12, saveResult: 'failure', saveDc: 999 });

    await waitFor(() => expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument());
    expect(document.querySelector('.abjure-results-list').textContent).toContain('Goblin B');
  });

  it('Careful Spell: protected PC is auto-resolved without a save prompt (explicit zero apply); unprotected PC still gets its prompt and pays on a fail', async () => {
    allySelection.getAllyList.mockReturnValue(['Player One']);

    render(<SaveAttackAoeModal {...makeProps({ metamagicCareful: true })} />);
    expect(checkboxFor('Player One').closest('.secondary-target-row').textContent).toContain('✓ Careful Spell protected');
    expect(checkboxFor('Player Two').closest('.secondary-target-row').textContent).not.toContain('Careful Spell');

    fireEvent.click(checkboxFor('Player One'));
    fireEvent.click(checkboxFor('Player Two'));
    await confirmPicked(2);

    // Protected PC: zero damage applied inline, NO prompt. Unprotected PC: full raw on the prompt.
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Player One', 0, ['Fire'], expect.anything());
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: 'Player Two',
      saveType: 'DEX',
      saveDc: 15,
      dcSuccess: 'half',
      rawDamage: 12,
    }));

    // Resolve Player Two's prompt with a failed save.
    const promptCall = savePromptService.sendSavePrompt.mock.calls[0][1];
    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: promptCall.promptId, success: false, rawDamage: 12, saveBonus: 4, total: 5, roll: 1, saveType: 'DEX', dcSuccess: 'half' },
      }));
    });

    await waitFor(() => expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Player Two', 12, ['Fire'], expect.anything()));
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    expect(rollbackRow('Player Two')).toMatchObject({ saveResult: 'failure', appliedDamage: 12 });

    await waitFor(() => expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument());
    expect(screen.getByText('Player One').closest('.abjure-result').textContent).toContain('Saved — takes no damage');
    expect(screen.getByText('Player Two').closest('.abjure-result').textContent).toContain('Failed — takes 12 Fire damage');
  });
});
