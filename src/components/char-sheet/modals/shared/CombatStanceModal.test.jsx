// @improved-by-ai
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

describe('CombatStanceModal', () => {
  describe('initial render', () => {
    it('renders the modal overlay, header, body, and actions sections', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the action name and paw icon in the header', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByText('Rage')).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-paw')).toBeInTheDocument();
    });

    it('displays the instruction text for Rage actions', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByText(/Choose a primal aspect of your Rage/)).toBeInTheDocument();
    });

    it('displays the instruction text for non-Rage actions', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'Movement' }) })} />);
      expect(screen.getByText(/Choose an elemental movement type/)).toBeInTheDocument();
    });

    it('renders all stance options with radio inputs', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByText('Bear')).toBeInTheDocument();
      expect(screen.getByText('Eagle')).toBeInTheDocument();
      expect(screen.getByText('Wolf')).toBeInTheDocument();
      expect(screen.getByText('Falcon')).toBeInTheDocument();
      expect(screen.getByText('Lion')).toBeInTheDocument();
      expect(screen.getByText('Ram')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(6);
    });

    it('shows no options when automation.options is empty', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ automation: { options: [] } }) })} />);
      expect(screen.getByText('Rage')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('renders gracefully when automation is missing', () => {
      render(<CombatStanceModal {...makeProps({ action: { name: 'Rage' } })} />);
      expect(screen.getByText('Rage')).toBeInTheDocument();
    });

    it('shows no options when automation exists but options is undefined', () => {
      render(<CombatStanceModal {...makeProps({ action: { name: 'Rage', automation: {} } })} />);
      expect(screen.getByText('Rage')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });
  });

  describe('selection behavior', () => {
    it('has no option selected initially', () => {
      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => expect(radio.checked).toBe(false));
    });

    it('selects an option when its radio is clicked', () => {
      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[2]);
      expect(radios[2].checked).toBe(true);
    });

    it('switches selection when a different option is clicked', () => {
      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      expect(radios[0].checked).toBe(true);
      fireEvent.click(radios[1]);
      expect(radios[0].checked).toBe(false);
      expect(radios[1].checked).toBe(true);
    });

    it('applies selected visual style to the chosen option', () => {
      render(<CombatStanceModal {...makeProps()} />);
      const labels = document.querySelectorAll('label');
      expect(labels[0].style.background).toBe('transparent');
      fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
      expect(labels[0].style.background).toContain('rgba(255');
    });
  });

  describe('apply button state', () => {
    it('is disabled when no option is selected', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Activate Rage/ })).toBeDisabled();
    });

    it('is enabled after selecting an option', () => {
      render(<CombatStanceModal {...makeProps()} />);
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
    it('calls applyStanceOption with correct arguments when activated', async () => {
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

    it('does not call applyStanceOption when activated with no selection', () => {
      combatStanceHandler.applyStanceOption.mockReset();

      render(<CombatStanceModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));
      expect(combatStanceHandler.applyStanceOption).not.toHaveBeenCalled();
    });

    it('passes the selected option name to applyStanceOption', async () => {
      combatStanceHandler.applyStanceOption.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Rage', description: 'Wolf chosen.' },
      });

      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[2]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

      await waitFor(() => {
        expect(combatStanceHandler.applyStanceOption).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Rage' }),
          mockPlayerStats,
          mockCampaignName,
          'Wolf'
        );
      });
    });

    it('uses wind icon for non-Rage actions', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'Movement' }) })} />);
      const btn = screen.getByRole('button', { name: /Activate Movement/ });
      expect(btn.querySelector('.fa-solid.fa-wind')).toBeInTheDocument();
    });
  });

  describe('applied state', () => {
    function applyStanceWith(description) {
      combatStanceHandler.applyStanceOption.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Rage', description },
      });
      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));
    }

    it('shows the result description after applying', async () => {
      applyStanceWith('Bear chosen.');
      await waitFor(() => {
        expect(screen.getByText(/Bear chosen/)).toBeInTheDocument();
      });
    });

    it('replaces selection UI with result and Done button', async () => {
      applyStanceWith('Bear chosen.');
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
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.innerHTML).toContain('<strong>Bear</strong>');
      });
    });

    it('does not show applied state when result is null', async () => {
      combatStanceHandler.applyStanceOption.mockResolvedValue(null);

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

  describe('close behavior', () => {
    function applyStanceWith(onClose, description) {
      combatStanceHandler.applyStanceOption.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Rage', description },
      });
      render(<CombatStanceModal {...makeProps({ onClose })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));
    }

    it('calls onClose when Done button is clicked in applied state', async () => {
      const onClose = vi.fn();
      applyStanceWith(onClose, 'Bear chosen.');
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<CombatStanceModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<CombatStanceModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<CombatStanceModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when clicking the overlay in applied state', async () => {
      const onClose = vi.fn();
      applyStanceWith(onClose, 'Bear chosen.');
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal in applied state', async () => {
      const onClose = vi.fn();
      applyStanceWith(onClose, 'Bear chosen.');
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('different stance options', () => {
    it('selects and applies Falcon stance', async () => {
      combatStanceHandler.applyStanceOption.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Rage', description: 'Falcon chosen.' },
      });

      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[3]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

      await waitFor(() => {
        expect(screen.getByText(/Falcon chosen/)).toBeInTheDocument();
      });
    });

    it('selects and applies Ram stance', async () => {
      combatStanceHandler.applyStanceOption.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Rage', description: 'Ram chosen.' },
      });

      render(<CombatStanceModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[5]);
      fireEvent.click(screen.getByRole('button', { name: /Activate Rage/ }));

      await waitFor(() => {
        expect(screen.getByText(/Ram chosen/)).toBeInTheDocument();
      });
    });

    it('shows effects descriptions for each stance option', () => {
      render(<CombatStanceModal {...makeProps()} />);
      expect(screen.getByText(/Resistance to all damage except Force, Necrotic, Psychic, Radiant/)).toBeInTheDocument();
      expect(screen.getByText(/Disengage and Dash as part of the bonus action/)).toBeInTheDocument();
      expect(screen.getByText(/Allies have Advantage on attack rolls against enemies within 5 ft/)).toBeInTheDocument();
      expect(screen.getByText(/Fly Speed equal to your Speed while raging/)).toBeInTheDocument();
      expect(screen.getByText(/Enemies within 5 ft have Disadvantage on attacks against targets other than you/)).toBeInTheDocument();
      expect(screen.getByText(/Melee hits cause Large or smaller creatures to have the Prone condition/)).toBeInTheDocument();
    });

    it('shows Cold elemental movement effects for non-Rage actions', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Cold' }] } }) })} />);
      expect(screen.getByText(/Ice Walk: Walk across icy\/water surfaces without checks; ignore ice\/snow difficult terrain/)).toBeInTheDocument();
    });

    it('shows Fire elemental movement effects with speed bonus', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Fire', speedBonus: 15 }] } }) })} />);
      expect(screen.getByText(/Speed Boost: \+15 feet to Speed/)).toBeInTheDocument();
    });

    it('shows Fire elemental movement effects with default speed bonus', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Fire' }] } }) })} />);
      expect(screen.getByText(/Speed Boost: \+10 feet to Speed/)).toBeInTheDocument();
    });

    it('shows Lightning elemental movement effects', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Lightning' }] } }) })} />);
      expect(screen.getByText(/Fly Speed equal to your Speed for 1 round/)).toBeInTheDocument();
    });

    it('shows Thunder elemental movement effects with teleport distance', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Thunder', teleportDistance: '60 ft' }] } }) })} />);
      expect(screen.getByText(/Teleport up to 60 ft to an unoccupied space you can see/)).toBeInTheDocument();
    });

    it('shows Thunder elemental movement effects with default teleport distance', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Thunder' }] } }) })} />);
      expect(screen.getByText(/Teleport up to 30 ft to an unoccupied space you can see/)).toBeInTheDocument();
    });

    it('renders options with no effects cleanly', () => {
      render(<CombatStanceModal {...makeProps({ action: makeAction({ name: 'ElementalStride', automation: { type: 'stance', options: [{ name: 'Lightning' }] } }) })} />);
      expect(screen.getByText('Lightning')).toBeInTheDocument();
    });
  });
});
