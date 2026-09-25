// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BoonFateModal from './BoonFateModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/reactions/boonOfFateHandler.js', () => ({
  applyBoonFateChoice: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as boonOfFateHandler from '../../../services/automation/handlers/reactions/boonOfFateHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Boon of Fate',
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
  effectiveAc: 17,
  saveDc: 13,
  saveType: 'Dexterity',
  saveResult: 'success',
  hit: true,
  rollType: 'attack',
  attackerName: 'Goblin1',
};

const baseRoll2d4 = { total: 5 };

const baseEventLabel = 'Attack by Goblin1';

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  roll2d4: baseRoll2d4,
  lastAttack: baseLastAttack,
  attackerName: baseLastAttack.attackerName,
  eventLabel: baseEventLabel,
  hitStatus: 'Hit',
  saveStatus: null,
  isAttack: true,
  isSave: false,
  isCheck: false,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function makeAction(overrides) {
  return { ...baseAction, ...(overrides || {}) };
}

function getBody() {
  return document.querySelector('.sp-body');
}

// ── Helpers ──

function renderModal(props) {
  return render(<BoonFateModal {...props} />);
}

// ── Tests ──

describe('BoonFateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders modal with action name in header', () => {
      renderModal(baseProps);
      expect(screen.getByText('Boon of Fate')).toBeInTheDocument();
    });

    it('renders default name when action name is missing', () => {
      const noNameAction = makeAction({ name: null });
      renderModal(makeProps({ action: noNameAction }));
      expect(screen.getByText('Improve Fate')).toBeInTheDocument();
    });

    it('renders event label as bold text', () => {
      renderModal(baseProps);
      expect(screen.getByText('Attack by Goblin1')).toBeInTheDocument();
    });

    it('renders original roll calculation with numeric bonus', () => {
      renderModal(baseProps);
      const body = getBody();
      expect(body.textContent).toContain('Original roll: d20(14) + 6 = 20');
    });

    it('renders hit status line for attack type', () => {
      renderModal(baseProps);
      const body = getBody();
      expect(body.textContent).toContain('vs AC 17 → Hit');
    });

    it('renders d2d4 roll result', () => {
      renderModal(baseProps);
      const body = getBody();
      expect(body.textContent).toContain('Rolled 2d4:');
      expect(body.textContent).toContain('5');
    });

    it('renders choice prompt text', () => {
      renderModal(baseProps);
      expect(screen.getByText('Choose how to apply the modifier:')).toBeInTheDocument();
    });

    it('renders bonus button with correct value', () => {
      renderModal(baseProps);
      expect(screen.getByRole('button', { name: 'Apply +5 (Bonus)' })).toBeInTheDocument();
    });

    it('renders penalty button with correct value', () => {
      renderModal(baseProps);
      expect(screen.getByRole('button', { name: 'Apply -5 (Penalty)' })).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      renderModal(baseProps);
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
      renderModal(props);
      const body = getBody();
      expect(body.textContent).toContain('vs DC 13 → Failure');
    });

    it('renders save status with custom save type', () => {
      const props = makeProps({
        isAttack: false,
        isSave: true,
        saveStatus: 'Success',
        eventLabel: 'CON by Goblin1',
        lastAttack: { ...baseLastAttack, saveType: 'Constitution' },
      });
      renderModal(props);
      const body = getBody();
      expect(body.textContent).toContain('vs DC 13 → Success');
    });

    it('does not render hit status when isAttack is false', () => {
      const props = makeProps({
        isAttack: false,
        isSave: false,
        hitStatus: null,
      });
      renderModal(props);
      expect(screen.queryByText(/vs AC/)).not.toBeInTheDocument();
    });

    it('does not render save status when isSave is false', () => {
      const props = makeProps({
        isAttack: true,
        isSave: false,
        saveStatus: null,
      });
      renderModal(props);
      expect(screen.queryByText(/vs DC/)).not.toBeInTheDocument();
    });

    it('hides hit status when hitStatus is null', () => {
      const props = makeProps({
        hitStatus: null,
      });
      renderModal(props);
      expect(screen.queryByText(/vs AC/)).not.toBeInTheDocument();
    });

    it('hides save status when saveStatus is null', () => {
      const props = makeProps({
        isSave: true,
        saveStatus: null,
      });
      renderModal(props);
      expect(screen.queryByText(/vs DC/)).not.toBeInTheDocument();
    });
  });

  // ── Bonus value computation edge cases ──

  describe('bonus value computation', () => {
    it('handles bonus as object with modifier', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, bonus: { modifier: 5, total: 8 } },
      });
      renderModal(props);
      const body = getBody();
      expect(body.textContent).toContain('Original roll: d20(14) + 5 = 19');
    });

    it('handles bonus as object with total when modifier is absent', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, bonus: { total: 7 } },
      });
      renderModal(props);
      const body = getBody();
      expect(body.textContent).toContain('Original roll: d20(14) + 7 = 21');
    });

    it('handles bonus as object with neither modifier nor total', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, bonus: {} },
      });
      renderModal(props);
      const body = getBody();
      expect(body.textContent).toContain('Original roll: d20(14) + 0 = 14');
    });

    it('handles bonus as a number', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, bonus: 4 },
      });
      renderModal(props);
      const body = getBody();
      expect(body.textContent).toContain('Original roll: d20(14) + 4 = 18');
    });

    it('handles missing d20 in lastAttack', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, d20: undefined },
      });
      renderModal(props);
      const body = getBody();
      expect(body.textContent).toContain('Original roll: d20() + 6 = 6');
    });
  });

  // ── Bonus/Penalty buttons ──

  describe('bonus and penalty buttons', () => {
    it.each([
      ['bonus', 'Apply +5 (Bonus)'],
      ['penalty', 'Apply -5 (Penalty)'],
    ])('calls applyBoonFateChoice with "%s" mode when %s button is clicked', async (mode, buttonName) => {
      boonOfFateHandler.applyBoonFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Boon of Fate',
          description: 'Boon of Fate result',
        },
      });
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
      await waitFor(() => {
        expect(boonOfFateHandler.applyBoonFateChoice).toHaveBeenCalledWith({
              action: baseAction,
              playerStats: basePlayerStats,
              campaignName: baseProps.campaignName,
              roll2d4: baseRoll2d4,
              lastAttack: baseLastAttack,
              mode,
          });
      });
    });

    it('does not call applyBoonFateChoice when cancel is clicked', async () => {
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(boonOfFateHandler.applyBoonFateChoice).not.toHaveBeenCalled();
    });
  });

  // ── Result view ──

  describe('result view', () => {
    it('renders the result description from payload', async () => {
      boonOfFateHandler.applyBoonFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Boon of Fate',
          description: 'Your custom result description',
        },
      });
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
      await waitFor(() => {
        expect(screen.getByText('Your custom result description')).toBeInTheDocument();
      });
    });

    it('renders Done button in result view', async () => {
      boonOfFateHandler.applyBoonFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Boon of Fate',
          description: 'Result',
        },
      });
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides selection buttons after applying', async () => {
      boonOfFateHandler.applyBoonFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Boon of Fate',
          description: 'Result',
        },
      });
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Apply +5 (Bonus)' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Apply -5 (Penalty)' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('hides choice prompt after applying', async () => {
      boonOfFateHandler.applyBoonFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Boon of Fate',
          description: 'Result',
        },
      });
      renderModal(baseProps);
      fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
      await waitFor(() => {
        expect(screen.queryByText('Choose how to apply the modifier:')).not.toBeInTheDocument();
      });
    });

    it('renders result with custom action name', async () => {
      const customAction = makeAction({ name: 'Divine Favor' });
      boonOfFateHandler.applyBoonFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Divine Favor',
          description: 'Result',
        },
      });
      renderModal(makeProps({ action: customAction }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
      await waitFor(() => {
        expect(screen.getByText('Divine Favor')).toBeInTheDocument();
      });
    });

    it('renders result with default name when action name is missing', async () => {
      const noNameAction = makeAction({ name: null });
      boonOfFateHandler.applyBoonFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Boon of Fate',
          description: 'Result',
        },
      });
      renderModal(makeProps({ action: noNameAction }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
      await waitFor(() => {
        expect(screen.getByText('Improve Fate')).toBeInTheDocument();
      });
    });
  });

  // ── Result view close behavior ──

  describe('result view close behavior', () => {
    it('does not close when overlay is clicked in result view', async () => {
      boonOfFateHandler.applyBoonFateChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Boon of Fate',
          description: 'Result',
        },
      });
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  // ── Initial render close behavior ──

  describe('initial render close behavior', () => {
    it('does not call onClose when overlay is clicked on initial render', () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not call onClose when modal content is clicked', () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── roll2d4 value variations ──

  describe('roll2d4 value variations', () => {
    it('renders roll2d4 of 2 (minimum)', () => {
      const props = makeProps({ roll2d4: { total: 2 } });
      renderModal(props);
      expect(screen.getByRole('button', { name: 'Apply +2 (Bonus)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply -2 (Penalty)' })).toBeInTheDocument();
    });

    it('renders roll2d4 of 8 (maximum)', () => {
      const props = makeProps({ roll2d4: { total: 8 } });
      renderModal(props);
      expect(screen.getByRole('button', { name: 'Apply +8 (Bonus)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply -8 (Penalty)' })).toBeInTheDocument();
    });
  });

  // ── AC display variations ──

  describe('AC display variations', () => {
    it('uses targetAc for AC display', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, targetAc: 18, effectiveAc: 16 },
      });
      renderModal(props);
      expect(screen.getByText(/vs AC 18/)).toBeInTheDocument();
    });

    it('falls back to effectiveAc when targetAc is missing', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, targetAc: null, effectiveAc: 16 },
      });
      renderModal(props);
      expect(screen.getByText(/vs AC 16/)).toBeInTheDocument();
    });

    it('shows em dash when both AC values are missing', () => {
      const props = makeProps({
        lastAttack: { ...baseLastAttack, targetAc: null, effectiveAc: null },
      });
      renderModal(props);
      expect(screen.getByText(/vs AC —/)).toBeInTheDocument();
    });
  });

  // ── Save DC display variations ──

  describe('save DC display variations', () => {
    it('uses saveDc for DC display', () => {
      const props = makeProps({
        isSave: true,
        saveStatus: 'Failure',
        lastAttack: { ...baseLastAttack, saveDc: 15 },
      });
      renderModal(props);
      expect(screen.getByText(/vs DC 15/)).toBeInTheDocument();
    });

    it('shows em dash when saveDc is missing', () => {
      const props = makeProps({
        isSave: true,
        saveStatus: 'Failure',
        lastAttack: { ...baseLastAttack, saveDc: null },
      });
      renderModal(props);
      expect(screen.getByText(/vs DC —/)).toBeInTheDocument();
    });
  });
});
