// @maintained-by-ai
// SaveAttackAoeModal DISPATCH-Guard lane (picker-confirm-live-while-prompts-stack).
// The picker route (real CreatureSelectionModal) stays MOUNTED behind the
// save-prompt/evasion/Results overlay stack until the Results modal closes.
// Before the fix the confirm button stayed live the whole time — a stray
// click re-ran the entire cast (double ability_use log + second savePrompt
// wave). Owned here (not duplicated in siblings):
//   1. after confirm with prompts queued, the picker remains visible with
//      its selection intact but the confirm button is disabled;
//   2. clicking confirm again does NOT re-dispatch (sendSavePrompt /
//      ability_use log stay at one);
//   3. same-tick double-click collapses to one dispatch (ref guard);
//   4. the prompt queue still round-trips and the Results summary + Close
//      behave exactly as before (damage-resolution.test.jsx regression pair).
//
// Harness mirrors SaveAttackAoeModal.damage-resolution.test.jsx (real-mount,
// honest half-on-save semantics, RNG stream keeping promptIds unique).

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules (data seams only — honest save semantics) ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
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
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
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

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';

// ── Fixtures ──

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
  characters: [{ name: 'Player One' }],
  onClose: vi.fn(),
};

// ── Helpers ──

function checkboxFor(name) {
  const row = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

function confirmButton() {
  return screen.getByRole('button', { name: /Fireball \(1\)/ });
}

function abilityUseLogs() {
  return logService.addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.type === 'ability_use');
}

function dispatchSaveResult(promptId, detail) {
  return act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
  });
}

// ── RNG stream (family seam: one draw per promptId, unique decimals) ──

let randomSpy;
let randomCursor = 0;

beforeEach(() => {
  vi.clearAllMocks();
  randomCursor = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    randomCursor = (randomCursor % 10) + 1;
    return 0.9 + randomCursor / 1000;
  });
  diceRoller.rollExpression.mockImplementation(() => ({ total: 12, rolls: [12], modifier: 0 }));
});

afterEach(() => randomSpy.mockRestore());

// ── Tests ──

describe('SaveAttackAoeModal - picker dispatch guard', () => {
  it('confirm while prompts queue: picker stays mounted with the selection visible but confirm is disabled', async () => {
    render(<SaveAttackAoeModal {...baseProps} />);
    fireEvent.click(checkboxFor('Player One'));
    await act(async () => {
      fireEvent.click(confirmButton());
    });

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);

    // Picker stays mounted (no premature summary): selection row still
    // rendered and still checked — the view does not invite re-dispatch…
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(checkboxFor('Player One')).toBeChecked();
    // …because the confirm control is disabled for the whole queue.
    expect(confirmButton()).toBeDisabled();
  });

  it('clicking confirm again during the prompt queue does NOT re-dispatch (no second prompt, no second log row)', async () => {
    render(<SaveAttackAoeModal {...baseProps} />);
    fireEvent.click(checkboxFor('Player One'));
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    expect(abilityUseLogs()).toHaveLength(1);

    // fireEvent.click bypasses the browser's disabled suppression (jsdom),
    // so this exercises the honest no-op guards behind the button: the
    // picker-level confirmDisabled check and the dispatchedRef latch.
    fireEvent.click(confirmButton());
    fireEvent.click(confirmButton());
    await act(async () => { await Promise.resolve(); });

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    expect(abilityUseLogs()).toHaveLength(1);
  });

  it('same-tick double-click collapses to a single dispatch (ref guard before state flush)', async () => {
    render(<SaveAttackAoeModal {...baseProps} />);
    fireEvent.click(checkboxFor('Player One'));
    await act(async () => {
      fireEvent.click(confirmButton());
      fireEvent.click(confirmButton());
    });

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
    expect(abilityUseLogs()).toHaveLength(1);
  });

  it('queue still resolves exactly as before: prompt round-trips, Results summary renders, Close works', async () => {
    const onClose = vi.fn();
    render(<SaveAttackAoeModal {...baseProps} onClose={onClose} />);
    fireEvent.click(checkboxFor('Player One'));
    await act(async () => {
      fireEvent.click(confirmButton());
    });

    const [prompt] = savePromptService.sendSavePrompt.mock.calls.map(c => c[1]);
    await dispatchSaveResult(prompt.promptId, {
      success: true, saveBonus: 4, rawDamage: 12, total: 19, roll: 19, saveType: 'DEX', dcSuccess: 'half',
    });

    // Summary replaces the picker with the resolved row, Close dismisses.
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Fireball — Results/)).toBeInTheDocument();
    expect(screen.getByText('Player One').closest('.abjure-result').textContent).toContain('Saved — takes 6 Fire damage');
    expect(damageRollback.addTargetResult).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: 'Player One', saveResult: 'success', appliedDamage: 6,
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
