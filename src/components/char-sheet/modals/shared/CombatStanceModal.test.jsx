// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CombatStanceModal from './CombatStanceModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/combatStanceHandler.js', () => ({
  applyStanceOption: vi.fn(),
}));

import * as combatStanceHandler from '../../../../services/automation/handlers/combat/combatStanceHandler.js';

const mockPlayerStats = { name: 'Throg', level: 12, class: { name: 'Barbarian' } };
const mockCampaignName = 'test-campaign';

const defaultAction = {
  name: 'Rage',
  automation: {
    type: 'stance',
    options: [
      { name: 'Bear', resistanceTypes: ['all_except_force_necrotic_psychic_radiant'] },
      { name: 'Eagle' },
      { name: 'Wolf' },
      { name: 'Falcon', flySpeed: 40, noArmor: true },
      { name: 'Lion' },
      { name: 'Ram' },
    ],
  },
};

function makeAction(overrides = {}) {
  return { ...defaultAction, ...overrides };
}

function makeProps(overrides = {}) {
  return {
    action: makeAction(overrides.action || {}),
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    onClose: vi.fn(),
    ...overrides,
  };
}

function mockAppliedStance(onClose = vi.fn(), description = 'Bear chosen.') {
  combatStanceHandler.applyStanceOption.mockResolvedValue({
    type: 'popup',
    payload: { type: 'automation_info', name: 'Rage', description },
  });
  render(<CombatStanceModal {...makeProps({ onClose })} />);
  const radios = document.querySelectorAll('input[type="radio"]');
  fireEvent.click(radios[0]);
  fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));
}

describe('CombatStanceModal', () => {
  describe('initial render', () => {
    it('renders the modal with action name and instruction text', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByText('Rage')).toBeInTheDocument();
      expect(screen.getByText(/Choose a primal aspect of your Rage/)).toBeInTheDocument();
    });

    it('renders all stance options with radio inputs and effects', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByText('Bear')).toBeInTheDocument();
      expect(screen.getByText('Eagle')).toBeInTheDocument();
      expect(screen.getByText('Wolf')).toBeInTheDocument();
      expect(screen.getByText('Falcon')).toBeInTheDocument();
      expect(screen.getByText('Lion')).toBeInTheDocument();
      expect(screen.getByText('Ram')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(6);
    });

    it('shows no options when automation.options is empty or undefined', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ automation: { options: [] } }) })} />);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
      render(<CombatStanceModal {...makeProps({ action: { name: 'Rage', automation: {} } })} />);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('renders gracefully when automation is missing', () => {
      render(<CombatStanceModal {...makeProps({ action: { name: 'Rage' } })} />);
      expect(screen.getByText('Rage')).toBeInTheDocument();
    });

    it('displays instruction text for non-Rage actions', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'Movement' }) })} />);
      expect(screen.getByText(/Choose an elemental movement type/)).toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    it('switches selection when a different option is clicked', () => {
      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      expect(radios[0].checked).toBe(true);
      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });
  });

  describe('apply button state', () => {
    it('is disabled when no option is selected and enabled after selection', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Activate Rage/ })).toBeDisabled();
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      expect(screen.getByRole('button', { name: /Activate Rage/ })).not.toBeDisabled();
    });

    it('is disabled when options array is empty', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ automation: { options: [] } }) })} />);
      expect(screen.getByRole('button', { name: /Activate Rage/ })).toBeDisabled();
    });
  });

  describe('apply behavior', () => {
    beforeEach(() => {
      combatStanceHandler.applyStanceOption.mockClear();
    });

    it('calls applyStanceOption with correct arguments and selected option name', async () => {
      combatStanceHandler.applyStanceOption.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Rage', description: 'Bear chosen.' },
      });

      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

      await waitFor(() => {
        expect(combatStanceHandler.applyStanceOption).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Rage' }),
          mockPlayerStats,
          mockCampaignName,
          'Bear'
        );
      });
    });

    it('does not call applyStanceOption when activated with no selection', async () => {
      render(<CombatStanceModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));
      expect(combatStanceHandler.applyStanceOption).not.toHaveBeenCalled();
    });

    it('handles error when applyStanceOption throws', async () => {
      combatStanceHandler.applyStanceOption.mockRejectedValue(new Error('Failed to apply stance'));

      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Bear chosen/)).not.toBeInTheDocument();
      });
    });
  });

  describe('applied state', () => {
    beforeEach(() => {
      combatStanceHandler.applyStanceOption.mockClear();
    });

    it('shows the result description after applying', async () => {
      mockAppliedStance();
      await waitFor(() => {
        expect(screen.getByText(/Bear chosen/)).toBeInTheDocument();
      });
    });

    it('replaces selection UI with result and Done button', async () => {
      mockAppliedStance();
      await waitFor(() => {
        expect(screen.queryByText(/Choose a primal aspect/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Activate Rage/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('renders the result description as HTML', async () => {
      combatStanceHandler.applyStanceOption.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Rage', description: '<strong>Bear</strong> chosen.' },
      });

      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

      await waitFor(() => {
        const strongEl = document.querySelector('.sp-body strong');
        expect(strongEl).toBeInTheDocument();
        expect(strongEl.textContent).toBe('Bear');
      });
    });

    it('does not show applied state when result is null or has no payload', async () => {
      combatStanceHandler.applyStanceOption.mockResolvedValue(null);

      render(<CombatStanceModal {...makeProps()} />);
      let radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Bear chosen/)).not.toBeInTheDocument();
      });

      document.body.innerHTML = '';

      combatStanceHandler.applyStanceOption.mockResolvedValue({ type: 'popup' });

      render(<CombatStanceModal {...makeProps()} />);
      radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });

    it('calls onClose when Done button is clicked in applied state', async () => {
      const onClose = vi.fn();
      mockAppliedStance(onClose);
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('different stance options', () => {
    it('shows effects descriptions for each stance option', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByText(/Resistance to all damage except Force, Necrotic, Psychic, Radiant/)).toBeInTheDocument();
      expect(screen.getByText(/Disengage and Dash as part of the bonus action/)).toBeInTheDocument();
      expect(screen.getByText(/Allies have Advantage on attack rolls against enemies within 5 ft/)).toBeInTheDocument();
      expect(screen.getByText(/Fly Speed equal to your Speed while raging/)).toBeInTheDocument();
      expect(screen.getByText(/Enemies within 5 ft have Disadvantage on attacks against targets other than you/)).toBeInTheDocument();
      expect(screen.getByText(/Melee hits cause Large or smaller creatures to have the Prone condition/)).toBeInTheDocument();
    });

    it('shows elemental movement effects', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Cold' }] } }) })} />);
      expect(screen.getByText(/Ice Walk: Walk across icy\/water surfaces without checks; ignore ice\/snow difficult terrain/)).toBeInTheDocument();

      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Fire', speedBonus: 15 }] } }) })} />);
      expect(screen.getByText(/Speed Boost: \+15 feet to Speed/)).toBeInTheDocument();

      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Fire' }] } }) })} />);
      expect(screen.getByText(/Speed Boost: \+10 feet to Speed/)).toBeInTheDocument();

      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Lightning' }] } }) })} />);
      expect(screen.getByText(/Fly Speed equal to your Speed for 1 round/)).toBeInTheDocument();

      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Thunder', teleportDistance: '60 ft' }] } }) })} />);
      expect(screen.getByText(/Teleport up to 60 ft to an unoccupied space you can see/)).toBeInTheDocument();

      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Thunder' }] } }) })} />);
      expect(screen.getByText(/Teleport up to 30 ft to an unoccupied space you can see/)).toBeInTheDocument();
    });
  });

  describe('close/cancel behavior', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<CombatStanceModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when overlay or modal content is clicked', () => {
      const onClose = vi.fn();
      render(<CombatStanceModal {...makeProps({ onClose })} />);
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();

      document.body.innerHTML = '';

      const onClose2 = vi.fn();
      render(<CombatStanceModal {...makeProps({ onClose: onClose2 })} />);
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose2).not.toHaveBeenCalled();
    });
  });
});
