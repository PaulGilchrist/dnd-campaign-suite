// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BonusActionChoiceModal from './BonusActionChoiceModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js', () => ({
  applyBonusActionChoice: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import * as bonusActionHandler from '../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js';
import * as logService from '../../../../services/ui/logService.js';

const baseAction = {
  name: 'Cunning Action',
  automation: {
    oncePerTurn: true,
    options: [
      { name: 'Dash', description: 'Double movement speed until end of turn.' },
      { name: 'Disengage', description: 'Movement doesn\'t provoke opportunity attacks.' },
      { name: 'Hide', description: 'Make a Dexterity (Stealth) check to hide.' },
    ],
  },
};

const baseProps = {
  action: baseAction,
  playerStats: { name: 'Rogue1', level: 3 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function selectOption(index) {
  const radios = document.querySelectorAll('input[type="radio"]');
  fireEvent.click(radios[index]);
}

// ── Initial render / display ──

describe('BonusActionChoiceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders modal with action name, prompt text, options, and buttons; Apply is disabled', () => {
      render(<BonusActionChoiceModal {...makeProps()} />);
      expect(screen.getByText('Cunning Action')).toBeInTheDocument();
      expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
      expect(screen.getByText('Dash')).toBeInTheDocument();
      expect(screen.getByText('Disengage')).toBeInTheDocument();
      expect(screen.getByText('Hide')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeDisabled();
    });

    it('selects an option when its radio is clicked and enables Apply', () => {
      render(<BonusActionChoiceModal {...makeProps()} />);
      selectOption(0);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios[0].checked).toBe(true);
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeEnabled();
    });
  });

  // ── Selection behavior ──

  describe('selection behavior', () => {
    it.each([
      { option: 'Dash', label: 'Dash' },
      { option: 'Disengage', label: 'Disengage' },
    ])('passes selected option name (%s) to handler when Apply is clicked', async ({ option }) => {
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Cunning Action',
          description: `${option} selected.`,
          automation: baseAction.automation,
        },
      });
      render(<BonusActionChoiceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[option === 'Dash' ? 0 : 1]);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalledWith(
        baseAction,
        baseProps.playerStats,
        'test-campaign',
        option
      );
    });

    it('does not call handler when Apply is clicked with no selection', () => {
      render(<BonusActionChoiceModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      expect(bonusActionHandler.applyBonusActionChoice).not.toHaveBeenCalled();
    });
  });

  // ── Apply flow ──

  describe('apply flow', () => {
    it('shows result and Done button after Apply, hides selection and Cancel', async () => {
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Cunning Action',
          description: 'Dash selected.',
          automation: baseAction.automation,
        },
      });
      render(<BonusActionChoiceModal {...makeProps()} />);
      selectOption(0);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Dash selected');
        expect(screen.queryByText('Choose a Bonus Action:')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Use Bonus Action/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toHaveClass('sp-roll-btn');
      });
    });

    it('calls onClose when Done button is clicked in applied state', async () => {
      const onClose = vi.fn();
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Cunning Action',
          description: 'Dash selected.',
          automation: baseAction.automation,
        },
      });
      render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
      selectOption(0);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked in applied state', async () => {
      const onClose = vi.fn();
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Cunning Action',
          description: 'Dash selected.',
          automation: baseAction.automation,
        },
      });
      render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
      selectOption(0);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it.each(['initial state', 'applied state'])('does not close when modal inner content is clicked in %s', async (state) => {
      const onClose = vi.fn();
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Cunning Action',
          description: 'Dash selected.',
          automation: baseAction.automation,
        },
      });
      render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
      if (state === 'applied state') {
        selectOption(0);
        fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });
      }
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not show applied state when handler returns null', async () => {
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue(null);
      render(<BonusActionChoiceModal {...makeProps()} />);
      selectOption(0);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });

  // ── Cancel / close behavior ──

  describe('cancel / close behavior', () => {
    it('calls onClose when Cancel button is clicked in initial state', async () => {
      const onClose = vi.fn();
      render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked in initial state', async () => {
      const onClose = vi.fn();
      render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Edge cases: missing/empty options ──

  describe('missing / empty options', () => {
    it.each([
      { label: 'no automation', action: { name: 'Empty Action' } },
      { label: 'null automation', action: { name: 'Null Automation', automation: null } },
      { label: 'empty options array', action: { name: 'Empty Options', automation: { options: [] } } },
    ])('renders disabled Apply with no radios when $label', ({ action }) => {
      render(<BonusActionChoiceModal {...makeProps({ action })} />);
      expect(screen.getByText(action.name)).toBeInTheDocument();
      expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeDisabled();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });
  });

  // ── Options prop override ──

  describe('options prop override', () => {
    it('uses options prop when provided, ignoring action.automation.options', () => {
      const action = {
        name: 'Cunning Action',
        automation: {
          options: [
            { name: 'Dash', description: 'Dash desc' },
            { name: 'Disengage', description: 'Disengage desc' },
          ],
        },
      };
      const optionsProp = [
        { name: 'Hide', description: 'Hide desc' },
      ];
      render(<BonusActionChoiceModal {...makeProps({ action, options: optionsProp })} />);
      expect(screen.getByText('Hide')).toBeInTheDocument();
      expect(screen.queryByText('Dash')).not.toBeInTheDocument();
      expect(screen.queryByText('Disengage')).not.toBeInTheDocument();
    });
  });

  // ── Custom action options ──

  describe('custom action options', () => {
    it('renders custom action options with correct header and names', () => {
      const actionWithSleight = {
        name: 'Fast Hands',
        automation: {
          oncePerTurn: true,
          options: [
            { name: 'Sleight of Hand', description: 'Make a Sleight of Hand check.' },
            { name: 'Thieves\' Tools', description: 'Use thieves\' tools.' },
          ],
        },
      };
      render(<BonusActionChoiceModal {...makeProps({ action: actionWithSleight })} />);
      expect(screen.getByText('Fast Hands')).toBeInTheDocument();
      expect(screen.getByText('Sleight of Hand')).toBeInTheDocument();
      expect(screen.getByText('Thieves\' Tools')).toBeInTheDocument();

      const actionMistyStep = {
        name: 'Misty Step',
        automation: {
          options: [{ name: 'Cast Misty Step', description: 'Teleport up to 30 feet.' }],
        },
      };
      render(<BonusActionChoiceModal {...makeProps({ action: actionMistyStep })} />);
      expect(screen.getByText('Misty Step')).toBeInTheDocument();
    });
  });

  // ── Result state edge cases ──

  describe('result state edge cases', () => {
    it('handles result with no payload gracefully', async () => {
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
        type: 'popup',
      });
      render(<BonusActionChoiceModal {...makeProps()} />);
      selectOption(0);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toBe('');
      });
    });
  });

  // ── Campaign logging ──

  describe('campaign logging', () => {
    it('calls addEntry with correct log data on apply', async () => {
      bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Cunning Action',
          description: 'Dash selected.',
          automation: baseAction.automation,
        },
      });
      render(<BonusActionChoiceModal {...makeProps()} />);
      selectOption(0);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
          type: 'ability_use',
          characterName: 'Rogue1',
          abilityName: 'Cunning Action',
          description: 'Dash selected — Object use',
        });
      });
    });

    it.each([
      { optionIndex: 0, actionName: 'Fast Hands', option: 'Sleight of Hand', description: "Sleight of Hand selected — Dexterity (Sleight of Hand) check initiated" },
      { optionIndex: 1, actionName: 'Fast Hands', option: "Thieves' Tools", description: "Thieves' Tools selected — Thieves' Tools check initiated" },
    ])('calls addEntry with %s description', async ({ optionIndex, actionName, description }) => {
      const actionWithSleight = {
        name: 'Fast Hands',
        automation: {
          oncePerTurn: true,
          options: [
            { name: 'Sleight of Hand', description: 'Make a Sleight of Hand check.' },
            { name: "Thieves' Tools", description: 'Use thieves\' tools.' },
          ],
        },
      };
      render(<BonusActionChoiceModal {...makeProps({ action: actionWithSleight })} />);
      selectOption(optionIndex);
      fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
      await waitFor(() => {
        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
          type: 'ability_use',
          characterName: 'Rogue1',
          abilityName: actionName,
          description,
        });
      });
    });
  });
});
