// @maintained-by-ai
// Heal-selection lane for SaveAttackHealModal: phase gating of the heal radios,
// heal-button enablement, exactly-one-target heal orchestration, and post-resolve
// Cancel / post-heal Done flows. Real HP math, clamping, and persistence are
// covered by SaveAttackHealModal.npc-heal.test.jsx (real applyHealing.js);
// save routing and pending-player UI live in SaveAttackHealModal.saveFlows.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackHealModal from './SaveAttackHealModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: {
    guid: vi.fn(() => 'test-guid-123'),
  },
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(() => null),
  },
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => ({ newHp: 30, maxHp: 40, actualHeal: 10, oldHp: 20 })),
}));

// ── Re-import mocked modules ──

import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';
import * as applyHealing from '../../../../services/rules/combat/applyHealing.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

// Deterministic dice: every expression the modal can roll in these flows,
// so the heal amount (2d8 → 10) is traceable to the exact expression.
const ROLLS = {
  '1d20': { total: 10, rolls: [10], modifier: 0 },
  '4d6': { total: 8, rolls: [2, 1, 3, 2], modifier: 0 },
  '2d8': { total: 10, rolls: [4, 6], modifier: 0 },
};

function getHealRadio(name) {
  const row = Array.from(document.querySelectorAll('.abjure-targets-list label'))
    .find(l => l.textContent.includes(name));
  if (!row) throw new Error(`Heal radio row for "${name}" not found`);
  return row.querySelector('input[type="radio"][name="healTarget"]');
}

/**
 * Select the given targets, apply the feature, and wait until every save is
 * resolved and the heal-selection phase is showing.
 */
async function resolveToHealSelection(getByRole, targetNames) {
  for (const name of targetNames) {
    fireEvent.click(getCheckboxByName(name));
  }
  await act(async () => {
    fireEvent.click(getByRole('button', { name: /Divine Smite \(\d targets?\)/ }));
  });
  await waitFor(() => {
    expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
    expect(screen.getByText(/Select one creature to heal for 2d8 HP/)).toBeInTheDocument();
  });
}

// ── Tests ──

describe('SaveAttackHealModal — heal flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockImplementation((expr) => {
      if (!ROLLS[expr]) throw new Error(`Unexpected roll expression: ${expr}`);
      return ROLLS[expr];
    });
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  it('gates the heal phase: no heal UI until all targets resolve, then one radio per resolved target', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);

    // Pre-apply: the heal phase does not exist yet.
    expect(document.querySelectorAll('input[type="radio"][name="healTarget"]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Heal Selected/ })).not.toBeInTheDocument();

    await resolveToHealSelection(getByRole, ['Goblin A', 'Goblin B']);

    // Exactly one radio per resolved target — both goblins, nothing else.
    const radios = document.querySelectorAll('input[type="radio"][name="healTarget"]');
    expect(radios).toHaveLength(2);
    expect(getHealRadio('Goblin A')).toBeInTheDocument();
    expect(getHealRadio('Goblin B')).toBeInTheDocument();
  });

  it('heals only the radio-selected creature and logs the healing roll to SSE and the log', async () => {
    const props = makeProps();
    const { getByRole } = render(<SaveAttackHealModal {...props} />);
    await resolveToHealSelection(getByRole, ['Goblin A', 'Goblin B']);

    // No selection yet: heal button is inert.
    const healBtn = screen.getByRole('button', { name: /Heal Selected/ });
    expect(healBtn).toBeDisabled();

    // Arbitrate "select one creature to heal": choose Goblin B, not the first row.
    await act(async () => {
      fireEvent.click(getHealRadio('Goblin B'));
    });
    expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });

    // Exactly one heal, aimed at the radio-picked target, amount from the 2d8 roll.
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1);
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(
      props.combatSummary,
      'Goblin B',
      10,
      'test-campaign'
    );
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledTimes(1);
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Goblin B',
      sourceName: 'Divine Smite',
      actualHeal: 10,
      newHp: 30,
      maxHp: 40,
    });
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      rollType: 'healing',
      name: 'Divine Smite',
      characterName: 'Cleric1',
      targetName: 'Goblin B',
      formula: '2d8',
      total: 10,
    }));
  });

  it('Cancel after all targets resolve closes the modal without healing', async () => {
    const onClose = vi.fn();
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({ onClose })} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    // Negative leg: cancelling in the heal phase must never execute a heal.
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
  });

  it('reports the heal result, then Done closes the modal', async () => {
    const onClose = vi.fn();
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({ onClose })} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);

    await act(async () => {
      fireEvent.click(getHealRadio('Goblin A'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Goblin A healed for');
      expect(body.textContent).toContain('10 HP (actual: 10). Current HP: 30 / 40.');
    });

    // Post-heal the modal offers only a terminal Done action.
    expect(screen.queryByRole('button', { name: /Heal Selected/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('resolved note and heal result render via scoped classes with zero inline style (no-inline-styles convention)', async () => {
    // fix#313 recipe pin: the former style={{ marginTop: '8px' }} statics on
    // renderBody's allResolved arm (:275/:286-era) now live as
    // .save-attack-heal-resolved-note / .save-attack-heal-result in
    // SaveAttackHealModal.css (exact-value migration). This component keeps no
    // dynamic-data inline sites — the whole modal must stay style-free.
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);

    const note = screen.getByText('All targets resolved.');
    expect(note.classList.contains('sp-note')).toBe(true);
    expect(note.classList.contains('save-attack-heal-resolved-note')).toBe(true);
    expect(note.getAttribute('style')).toBeNull();

    await act(async () => {
      fireEvent.click(getHealRadio('Goblin A'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });

    await waitFor(() => {
      expect(document.querySelector('.save-attack-heal-result')).toBeTruthy();
    });
    const result = document.querySelector('.save-attack-heal-result');
    expect(result.textContent).toContain('Goblin A healed for');
    expect(result.getAttribute('style')).toBeNull();
    // Zero-inline census across the whole resolved/healed body.
    expect(document.querySelector('.sp-body [style]')).toBeNull();
  });
});
