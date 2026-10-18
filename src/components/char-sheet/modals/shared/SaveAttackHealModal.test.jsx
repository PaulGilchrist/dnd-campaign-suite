// @maintained-by-ai
// Render/selection lane for SaveAttackHealModal: the pre-apply selection screen —
// instruction text (save type/DC/range, damage preview, heal preview), the checkbox
// list built from combatSummary (attacker excluded), count + apply-button gating
// through the toggle path, and Cancel-to-close. Nothing here rolls dice or prompts
// saves (dice mock throws on drift to pin that). Sibling lanes:
// saveFlows.test.jsx owns save routing/arithmetic/persistence;
// healFlows.test.jsx owns radio arbitration/report/Done;
// npc-heal.test.jsx owns CLA-208 real HP restoration;
// AreaEffectTargetModalBase.targets/.utils tests own eligible-target filtering
// (incl. null/empty combatSummary and the "No valid targets in range." empty row).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackHealModal from './SaveAttackHealModal.jsx';

// ── Mocked modules ──

// Transport guard: this lane never applies, so these must stay uncalled.
vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

// Throw-on-drift dice: any roll here means apply/save/heal flow leaked into the
// render/selection lane.
vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((expr) => {
    throw new Error(`Render/selection lane must not roll dice (asked for "${expr}")`);
  }),
}));

// ── Re-import mocked modules ──

import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

function getApplyButton() {
  return screen.getByRole('button', { name: /Divine Smite/ });
}

// The names the modal shows in its target rows, in render order.
function getCheckboxNames() {
  return Array.from(document.querySelectorAll('.abjure-target-row .abjure-target-name'))
    .map(el => el.textContent);
}

// ── Tests ──

describe('SaveAttackHealModal — render/selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays save, damage, and heal instructions with zero targets selected', () => {
    render(<SaveAttackHealModal {...makeProps()} />);

    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Select creatures within 30 feet');
    expect(body.textContent).toContain('CON');
    expect(body.textContent).toContain('saving throw (DC 10)');
    expect(screen.getByText(/On a failed save.*4d6.*Radiant.*damage/)).toBeInTheDocument();
    expect(screen.getByText(/half damage/)).toBeInTheDocument();
    expect(screen.getByText(/heal for.*2d8.*HP/)).toBeInTheDocument();
    expect(screen.getByText(/Targets selected: 0\/3/)).toBeInTheDocument();
  });

  it('lists every creature except the attacker as a checkbox, all unchecked', () => {
    const { unmount } = render(<SaveAttackHealModal {...makeProps()} />);
    expect(getCheckboxNames()).toEqual(['Goblin A', 'Goblin B', 'Player One']);
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(0);
    unmount();

    // Attacker joins the roster: exactly the other two remain selectable.
    render(<SaveAttackHealModal {...makeProps({ attackerName: 'Goblin A' })} />);
    expect(getCheckboxNames()).toEqual(['Goblin B', 'Player One']);
    expect(screen.getByText(/Targets selected: 0\/2/)).toBeInTheDocument();
  });

  it('tracks selection through the toggle path: checkboxes, count, and apply button', () => {
    render(<SaveAttackHealModal {...makeProps()} />);

    // Nothing selected: apply is inert with a zero-count label.
    expect(getApplyButton()).toBeDisabled();
    expect(getApplyButton()).toHaveTextContent('Divine Smite (0 targets)');

    const goblinA = getCheckboxByName('Goblin A');
    fireEvent.click(goblinA);
    expect(goblinA.checked).toBe(true);
    expect(screen.getByText(/Targets selected: 1\/3/)).toBeInTheDocument();
    expect(getApplyButton()).toBeEnabled();
    expect(getApplyButton()).toHaveTextContent('Divine Smite (1 target)');

    fireEvent.click(getCheckboxByName('Goblin B'));
    expect(screen.getByText(/Targets selected: 2\/3/)).toBeInTheDocument();
    expect(getApplyButton()).toHaveTextContent('Divine Smite (2 targets)');

    // Toggle off decrements rather than clearing, and re-click restores.
    fireEvent.click(goblinA);
    expect(goblinA.checked).toBe(false);
    expect(screen.getByText(/Targets selected: 1\/3/)).toBeInTheDocument();

    fireEvent.click(getCheckboxByName('Goblin B'));
    expect(screen.getByText(/Targets selected: 0\/3/)).toBeInTheDocument();
    expect(getApplyButton()).toBeDisabled();

    // Selection alone must not touch dice, save prompts, or results.
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
    expect(document.querySelector('.abjure-results-list')).not.toBeInTheDocument();
  });

  it('Cancel closes the modal without rolling, prompting, or applying', () => {
    const onClose = vi.fn();
    render(<SaveAttackHealModal {...makeProps({ onClose })} />);

    fireEvent.click(getCheckboxByName('Goblin A'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
  });
});
