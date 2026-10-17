// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BastionOfLawSpendModal from './BastionOfLawSpendModal.jsx';

// ── Ownership ──
// This file owns the SPEND-dice modal UI in isolation: ward dice count and
// damage-info rendering (with clamping), the Roll & Reduce seam emitting
// exactly (1, same-object roll result) without closing, Done-close, and
// overlay inertness.
// Deferred to owners:
// - CharReactions.jsx render site / CharReactions.edgeCases.test.jsx — the
//   onConfirm → executeHandler({ automation: 'bastion_of_law_spend', numDice,
//   preRollResult }) wrapper and popup/modal result handling.
// - bastionOfLawHandler.js handleSpendDice — ward die deduction, damage
//   reduction, bastionOfLawWard* runtime writes, and campaign-log entries.
// - restRules-longRest.js resetBastionOfLaw — long-rest ward reset.
// - BastionOfLawModal.test.jsx — the create-ward lane (separate component).

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';

// ── Helpers ──

// Live mutable store the mocked runtime reads drain from — tests mutate
// wardStore directly instead of re-mocking per scenario.
let wardStore;

// Frozen so the payload-identity assertion proves the component forwards
// rollExpression's result untouched.
const rollFixture = Object.freeze({ total: 15, rolls: [8, 7], modifier: 0, formula: '1d8' });

function makeProps(overrides = {}) {
  return {
    featureName: 'Bastion of Law',
    playerName: 'AllyWarrior',
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderModal(overrides) {
  return render(<BastionOfLawSpendModal {...makeProps(overrides)} />);
}

const rollBtn = () => screen.getByRole('button', { name: 'Roll & Reduce Damage' });
const doneBtn = () => screen.getByRole('button', { name: 'Done' });

// NOTE — flagged product defects (parity audit vs the create-ward sibling),
// not fixed here:
// 1. handleSpendDice awaits onConfirm with no try/catch — a rejected confirm
//    leaks an unhandled rejection AND skips the 3-second roll-result clear,
//    leaving stale feedback on screen forever.
// 2. Dead code: disabled={wardDice.length === 0} sits inside a block that
//    only renders when wardDice.length > 0, so the button can never disable.
// The sibling's zero-pool `Number(spPool) || spMax` lie and debug
// console.error leftovers are NOT shared here: no SP-pool read, no logging.

// ── Tests ──

describe('BastionOfLawSpendModal', () => {
  beforeEach(() => {
    wardStore = {
      bastionOfLawWardDice: ['1d8', '1d8', '1d8'],
      bastionOfLawLastAttackDamage: 20,
      bastionOfLawWardUsed: 5,
    };
    runtimeState.useRuntimeValue.mockImplementation((_player, key) => wardStore[key]);
    diceRoller.rollExpression.mockReturnValue(rollFixture);
  });

  afterEach(() => {
    runtimeState.useRuntimeValue.mockReset();
    diceRoller.rollExpression.mockReset();
    vi.useRealTimers();
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the header, ward prompt, dice count, and both buttons verbatim with no roll feedback yet', () => {
      renderModal();
      expect(screen.getByText('Bastion of Law')).toBeInTheDocument();
      expect(screen.getByText(
        'Your magical ward is active. When you take damage, spend dice from the ward to reduce it.'
      )).toBeInTheDocument();
      expect(screen.getByText('3d8')).toBeInTheDocument();
      expect(screen.getByText('dice remaining')).toBeInTheDocument();
      expect(rollBtn()).toBeEnabled();
      expect(doneBtn()).toBeInTheDocument();
      expect(screen.queryByText(/Remaining: \d+d8/)).not.toBeInTheDocument();
    });

    it('reads each ward runtime key once with exact arguments', () => {
      renderModal();
      expect(runtimeState.useRuntimeValue).toHaveBeenCalledTimes(3);
      expect(runtimeState.useRuntimeValue).toHaveBeenCalledWith(
        'AllyWarrior', 'bastionOfLawWardDice', 'test-campaign'
      );
      expect(runtimeState.useRuntimeValue).toHaveBeenCalledWith(
        'AllyWarrior', 'bastionOfLawLastAttackDamage', 'test-campaign'
      );
      expect(runtimeState.useRuntimeValue).toHaveBeenCalledWith(
        'AllyWarrior', 'bastionOfLawWardUsed', 'test-campaign'
      );
    });
  });

  // ── Damage info derivation ──

  describe('damage info derivation', () => {
    it.each([
      { label: 'normal split', damage: 20, used: 5, totalText: 'Total damage from last attack: 20', usedText: 'Ward already used: 5', remainingText: 'Remaining damage to ward: 15' },
      { label: 'null damage renders 0', damage: null, used: 3, totalText: 'Total damage from last attack: 0', usedText: 'Ward already used: 3', remainingText: 'Remaining damage to ward: 0' },
      { label: 'null wardUsed renders 0', damage: 25, used: null, totalText: 'Total damage from last attack: 25', usedText: 'Ward already used: 0', remainingText: 'Remaining damage to ward: 25' },
      { label: 'over-used ward clamps to 0', damage: 5, used: 10, totalText: 'Total damage from last attack: 5', usedText: 'Ward already used: 10', remainingText: 'Remaining damage to ward: 0' },
    ])('$label', ({ damage, used, totalText, usedText, remainingText }) => {
      wardStore.bastionOfLawLastAttackDamage = damage;
      wardStore.bastionOfLawWardUsed = used;
      renderModal();
      expect(screen.getByText(totalText)).toBeInTheDocument();
      expect(screen.getByText(usedText)).toBeInTheDocument();
      expect(screen.getByText(remainingText)).toBeInTheDocument();
    });
  });

  // ── Ward dice gating ──

  describe('ward dice gating', () => {
    it.each([
      { label: 'three dice', dice: ['1d8', '1d8', '1d8'], countText: '3d8', hasRoll: true },
      { label: 'single die', dice: ['1d8'], countText: '1d8', hasRoll: true },
      { label: 'empty ward', dice: [], countText: '0d8', hasRoll: false },
      { label: 'missing runtime value', dice: undefined, countText: '0d8', hasRoll: false },
    ])('shows $countText with roll button rendered ($hasRoll) for $label', ({ dice, countText, hasRoll }) => {
      wardStore.bastionOfLawWardDice = dice;
      renderModal();
      expect(screen.getByText(countText)).toBeInTheDocument();
      if (hasRoll) {
        expect(rollBtn()).toBeEnabled();
      } else {
        expect(screen.queryByRole('button', { name: 'Roll & Reduce Damage' })).not.toBeInTheDocument();
      }
    });
  });

  // ── Roll & reduce seam ──

  describe('roll & reduce seam', () => {
    it('rolls exactly 1d8 and emits (1, same-object roll result) without closing', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      renderModal({ onConfirm, onClose });

      await act(async () => {
        fireEvent.click(rollBtn());
      });

      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(1, rollFixture);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByText('1d8: [8, 7] =')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Remaining: 2d8')).toBeInTheDocument();
    });

    it('auto-clears the roll feedback after 3 seconds without re-rolling', async () => {
      vi.useFakeTimers();
      renderModal();

      await act(async () => {
        fireEvent.click(rollBtn());
      });
      expect(screen.getByText('Remaining: 2d8')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.queryByText('Remaining: 2d8')).not.toBeInTheDocument();
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(doneBtn()).toBeInTheDocument();
    });
  });

  // ── Close flows ──

  describe('close flows', () => {
    it('closes once when Done is clicked without rolling or confirming', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      renderModal({ onClose, onConfirm });

      fireEvent.click(doneBtn());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('stays inert when the overlay is clicked', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      renderModal({ onClose, onConfirm });

      fireEvent.click(document.querySelector('.sp-overlay'));

      expect(onClose).not.toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
      expect(doneBtn()).toBeInTheDocument();
      expect(screen.getByText('3d8')).toBeInTheDocument();
    });
  });
});
