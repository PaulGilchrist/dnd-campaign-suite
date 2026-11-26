// @maintained-by-ai 2026-11-18
// MA 2026-11-18 backlog: the Charge chooser radios rendered aria-label=null
// while the sibling ShieldBashChoiceModal radios carry `aria-label="<Option>
// <target>"` (7357a6689 tier) — cross-chooser role/accessible-name probes could
// not reach the rider rows. Every option input (single-select radio,
// multi-select checkbox) now carries the explicit `<Option> <target>` name, and
// the no-target mount resolves by the bare option name (the instruction line
// already drops " against <T>" then — buildRiderLabelText).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackRiderModal from './AttackRiderModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/attackRiderHandler.js', () => ({
  applyRiderOption: vi.fn(),
  handle: vi.fn(),
}));
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js', () => ({
  applyVersatileTrickster: vi.fn(),
}));

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import {
  makeProps, makeMultiSelectAction,
} from './AttackRiderModal.test-utils.js';

// Charger option bytes as attackRollRiders.js feeds them (same shape the
// charger-rows pin uses) — the backlog scenario: Charge chooser vs "Goblin".
const chargerAction = {
  name: 'Charge Attack',
  automation: {
    type: 'attack_rider',
    maxEffects: 1,
    options: [
      { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d8' },
      { name: 'Push 10 ft', effect: 'push', value: 10, sizeLimit: 'one_size_larger' },
    ],
  },
};

function allOptionInputs() {
  return [...document.querySelectorAll('.sp-body input[type="radio"], .sp-body input[type="checkbox"]')];
}

describe('AttackRiderModal option aria-labels (ShieldBashChoiceModal parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('single-select radios carry "<Option> <target>" names resolvable by role locator', () => {
    render(<AttackRiderModal {...makeProps({ action: chargerAction, targetName: 'Goblin' })} />);

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Damage Bonus Goblin' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Push 10 ft Goblin' })).toBeInTheDocument();
    // Same names resolvable via raw attribute selectors (automation parity,
    // mirrors the ShieldBashChoiceModal.test.jsx "Goblin 2" pin).
    expect(document.querySelector('input[aria-label="Push 10 ft Goblin"]')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Push 10 ft Goblin' }).getAttribute('aria-label'))
      .toBe('Push 10 ft Goblin');
    // The aria-label overrides the mashed label text: no effect-copy bleed.
    expect(screen.getByRole('radio', { name: 'Damage Bonus Goblin' }).closest('label').textContent)
      .toBe('Damage Bonus— 1d8 damage');
  });

  it('multi-select checkboxes carry "<Option> <target>" names on every row', () => {
    render(<AttackRiderModal {...makeProps({ action: makeMultiSelectAction() })} />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Disadvantage Curse Goblin A' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'No Opportunity Goblin A' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Speed Drain Goblin A' })).toBeInTheDocument();
    // Selecting by accessible name gates Apply Effects exactly as before.
    const apply = screen.getByRole('button', { name: /Apply Effects$/ });
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Speed Drain Goblin A' }));
    expect(screen.getByRole('checkbox', { name: 'Speed Drain Goblin A' })).toBeChecked();
    expect(apply).not.toBeDisabled();
  });

  it('no-target mount drops the target segment — rows resolve by bare option name', () => {
    // The sibling interpolates a always-present target; this chooser
    // legitimately mounts without one (instruction reads "Choose an effect:"),
    // so the aria drops the segment rather than rendering "… undefined".
    render(<AttackRiderModal {...makeProps({ action: chargerAction, targetName: null })} />);

    expect(screen.getByRole('radio', { name: 'Damage Bonus' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Push 10 ft' })).toBeInTheDocument();
    for (const input of allOptionInputs()) {
      expect(input.getAttribute('aria-label')).not.toMatch(/undefined|null/);
      expect(input.getAttribute('aria-label')).toBe(input.getAttribute('aria-label').trim());
    }
  });

  it('zero option inputs remain without an explicit aria-label (single, multi)', () => {
    const { unmount } = render(<AttackRiderModal {...makeProps()} />);
    const radios = allOptionInputs();
    expect(radios.length).toBeGreaterThan(0);
    for (const input of radios) {
      expect(input.getAttribute('aria-label')).toBeTruthy();
    }
    unmount();

    render(<AttackRiderModal {...makeProps({ action: makeMultiSelectAction() })} />);
    const checkboxes = allOptionInputs();
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const input of checkboxes) {
      expect(input.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
