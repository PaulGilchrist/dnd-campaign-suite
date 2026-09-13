// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BendFateModal from './BendFateModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/reactions/reactionBonusHandler.js', () => ({
  applyBendFateChoice: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as reactionBonusHandler from '../../../services/automation/handlers/reactions/reactionBonusHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Bend Luck',
  automation: {
    type: 'class_feature',
    effect: 'bonus_or_penalty_choice',
  },
};

const basePlayerStats = { name: 'Paladin1', level: 5 };

const baseLastAttack = {
  d20: 14,
  bonus: 6,
  targetAc: 17,
  effectiveAc: null,
  saveDc: 13,
  saveType: 'Dexterity',
  saveResult: 'success',
  hit: true,
  rollType: 'attack',
  attackerName: 'Goblin1',
};

const baseD4Roll = { total: 3 };

const baseEventLabel = 'Attack by Goblin1';

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  d4Roll: baseD4Roll,
  lastAttack: baseLastAttack,
  attackerName: baseLastAttack.attackerName,
  eventLabel: baseEventLabel,
  hitStatus: 'Hit',
  saveStatus: null,
  isAttack: true,
  isSave: false,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function makeAction(overrides) {
  return { ...baseAction, ...(overrides || {}) };
}

// ── Helpers ──

function renderModal(props) {
  return render(<BendFateModal {...props} />);
}

function bodyText(props) {
  renderModal(props);
  return document.querySelector('.sp-body').textContent;
}

// ── Tests ──

describe('BendFateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders modal with action name in header', () => {
      renderModal(baseProps);
      expect(screen.getByText('Bend Luck')).toBeInTheDocument();
    });

    it('renders default name when action name is missing', () => {
      const noNameAction = makeAction({ name: null });
      renderModal(makeProps({ action: noNameAction }));
      expect(screen.getByText('Bend Luck')).toBeInTheDocument();
    });

    it('renders event label, roll calculation, and buttons', () => {
      const { container } = renderModal(baseProps);
      const body = container.querySelector('.sp-body');
      expect(body.textContent).toContain('Attack by Goblin1');
      expect(body.textContent).toContain('Original roll: d20(14) + 6 = 20');
      expect(body.textContent).toContain('vs AC 17 → Hit');
      expect(body.textContent).toContain('Rolled 1d4:');
      expect(body.textContent).toContain('3');
      expect(body.textContent).toContain('Choose how to apply the modifier:');
      expect(screen.getByRole('button', { name: /Apply \+3 \(Bonus\)/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Apply -3 \(Penalty\)/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Save type display ──

  describe('save type display', () => {
    it('renders save status line for save type', () => {
      const props = makeProps({
        isAttack: false,
        isSave: true,
        saveStatus: 'Failure',
        eventLabel: 'Saving Throw by Goblin1',
      });
      expect(bodyText(props)).toContain('vs DC 13 → Failure');
    });

    it('omits hit status when isAttack is false', () => {
      const props = makeProps({ isAttack: false, isSave: false, hitStatus: null });
      renderModal(props);
      expect(screen.queryByText(/vs AC/)).not.toBeInTheDocument();
    });
  });

  // ── Bonus value computation ──

  describe('bonus value computation', () => {
    it('extracts modifier from bonus object', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, bonus: { modifier: 5, total: 8 } },
      });
      expect(bodyText(props)).toContain('Original roll: d20(14) + 5 = 19');
    });

    it('renders original roll with numeric bonus', () => {
      expect(bodyText(baseProps)).toContain('Original roll: d20(14) + 6 = 20');
    });
  });

  // ── AC and DC display ──

  describe('AC and DC display', () => {
    it('uses targetAc for AC display', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, targetAc: 18, effectiveAc: null },
      });
      renderModal(props);
      expect(screen.getByText(/vs AC 18/)).toBeInTheDocument();
    });

    it('uses saveDc for save DC display', () => {
      const props = makeProps({
        isSave: true,
        saveStatus: 'Failure',
        lastAttack: { ...baseLastAttack, saveDc: 15 },
      });
      renderModal(props);
      expect(screen.getByText(/vs DC 15/)).toBeInTheDocument();
    });
  });

  // ── d4 roll value variations ──

  describe('d4 roll value variations', () => {
    it('renders buttons with different d4 roll values', () => {
      const props = makeProps({ d4Roll: { total: 1 } });
      renderModal(props);
      expect(screen.getByRole('button', { name: 'Apply +1 (Bonus)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply -1 (Penalty)' })).toBeInTheDocument();
    });
  });

  // ── Bonus/Penalty button interactions ──

  describe('bonus and penalty button interactions', () => {
    it('calls applyBendFateChoice with correct mode when bonus button is clicked', async () => {
      reactionBonusHandler.applyBendFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Bend Luck',
          description: 'Bend Luck result',
        },
      });
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Apply +3 (Bonus)' }));
      await waitFor(() => {
        expect(reactionBonusHandler.applyBendFateChoice).toHaveBeenCalledWith({
              action: baseAction,
              playerStats: basePlayerStats,
              campaignName: baseProps.campaignName,
              d4Roll: baseD4Roll,
              lastAttack: baseLastAttack,
              mode: 'bonus',
          });
      });
    });
  });

  // ── Result view ──

  describe('result view', () => {
    it('shows result view with action name and description after applyBendFateChoice resolves', async () => {
      reactionBonusHandler.applyBendFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Bend Luck',
          description: 'Attack: d20(14) + 6+3 = <strong>23</strong> vs AC 17 → HIT',
        },
      });
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Apply +3 (Bonus)' }));
      await waitFor(() => {
        expect(screen.getByText('Bend Luck')).toBeInTheDocument();
        expect(screen.getByText(/Attack: d20/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides selection buttons and choice prompt after applying', async () => {
      reactionBonusHandler.applyBendFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Bend Luck',
          description: 'Result',
        },
      });
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Apply +3 (Bonus)' }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Apply +3 (Bonus)' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Apply -3 (Penalty)' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByText('Choose how to apply the modifier:')).not.toBeInTheDocument();
      });
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when cancel is clicked', () => {
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked on initial render', () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('prevents modal content clicks from closing', () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Error handling ──

  describe('error handling', () => {
    it('keeps selection UI visible when applyBendFateChoice rejects', async () => {
      reactionBonusHandler.applyBendFateChoice.mockRejectedValue(new Error('Network error'));
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Apply +3 (Bonus)' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Apply +3 (Bonus)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply -3 (Penalty)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });
});
