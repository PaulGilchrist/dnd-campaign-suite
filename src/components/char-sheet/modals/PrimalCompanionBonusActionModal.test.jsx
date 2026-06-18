// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PrimalCompanionBonusActionModal from './PrimalCompanionBonusActionModal.jsx';

vi.mock('../../../services/automation/handlers/class-ranger/primalCompanionHandler.js', () => ({
  applyBonusActionCommand: vi.fn(() => Promise.resolve({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Primal Companion',
      automationType: 'bonus_action',
      description: 'Primal Companion: Commanded Wolf to take a Dash action as a Bonus Action.',
      automation: { type: 'bonus_action' },
    },
  })),
}));

import * as primalCompanionHandler from '../../../services/automation/handlers/class-ranger/primalCompanionHandler.js';

const baseProps = {
  action: {
    name: 'Primal Companion',
    automation: { type: 'bonus_action' },
  },
  playerStats: { name: 'Ranger1', level: 5 },
  campaignName: 'test-campaign',
  companionType: 'Wolf',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

describe('PrimalCompanionBonusActionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('initial render', () => {
    it('renders the modal overlay, container, header, body, and actions sections', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the header with action name and Font Awesome hands icon', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      expect(screen.getByText('Primal Companion')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-hands')).toBeInTheDocument();
    });

    it('displays the companion type instruction text in the body', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Command your');
      expect(body.textContent).toContain('Wolf');
      expect(body.textContent).toContain('to take a Bonus Action');
    });

    it('renders all four bonus action command options with descriptions', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      const body = document.querySelector('.sp-body');
      expect(screen.getByText('Dash')).toBeInTheDocument();
      expect(screen.getByText('Disengage')).toBeInTheDocument();
      expect(screen.getByText('Dodge')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
      expect(body.textContent).toContain('Double movement speed this turn');
      expect(body.textContent).toContain("Movement doesn't trigger opportunity attacks");
      expect(body.textContent).toContain('Attackers have disadvantage against the companion');
      expect(body.textContent).toContain('Next ally attack against a target has advantage');
    });

    it('renders 4 radio inputs all with the correct name and none checked by default', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(4);
      radios.forEach(radio => {
        expect(radio.name).toBe('primalCompanionBonusAction');
        expect(radio.checked).toBe(false);
      });
    });

    it('renders Cancel and Command Companion buttons with correct icons', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', { name: /Command Companion/ });
      expect(submitBtn).toBeDisabled();
      expect(submitBtn.querySelector('.fa-hands')).toBeInTheDocument();
    });

    it('does not render the force damage option by default', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      expect(screen.queryByLabelText(/Deal Force damage/)).not.toBeInTheDocument();
    });
  });

  describe('overlay and dismiss behavior', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('command selection', () => {
    const commands = ['Dash', 'Disengage', 'Dodge', 'Help'];

    it.each(commands)('selects "%s" when clicked and enables the Command button', async (command) => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      const submitBtn = screen.getByRole('button', { name: /Command Companion/ });
      expect(submitBtn).toBeDisabled();
      await act(async () => {
        fireEvent.click(screen.getByText(command));
      });
      expect(submitBtn).toBeEnabled();
      const label = screen.getByText(command).closest('label');
      expect(label.querySelector('input')).toBeChecked();
    });

    it('switches selection when clicking a different command', async () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Dash'));
      });
      expect(screen.getByText('Dash').closest('label').querySelector('input')).toBeChecked();
      await act(async () => {
        fireEvent.click(screen.getByText('Disengage'));
      });
      expect(screen.getByText('Dash').closest('label').querySelector('input')).not.toBeChecked();
      expect(screen.getByText('Disengage').closest('label').querySelector('input')).toBeChecked();
    });
  });

  describe('force damage option', () => {
    const withForceDamage = (overrides = {}) => makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: true } },
      ...overrides,
    });

    it('renders the force damage checkbox when forceDamageOption is true', () => {
      render(<PrimalCompanionBonusActionModal {...withForceDamage()} />);
      expect(screen.getByLabelText(/Deal Force damage/)).toBeInTheDocument();
    });

    it('does not render the force damage checkbox when forceDamageOption is false', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps({
        action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: false } }
      })} />);
      expect(screen.queryByLabelText(/Deal Force damage/)).not.toBeInTheDocument();
    });

    it('does not render the force damage checkbox when forceDamageOption is undefined', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps({
        action: { name: 'Primal Companion', automation: { type: 'bonus_action' } }
      })} />);
      expect(screen.queryByLabelText(/Deal Force damage/)).not.toBeInTheDocument();
    });

    it('defaults the force damage checkbox to unchecked', () => {
      render(<PrimalCompanionBonusActionModal {...withForceDamage()} />);
      expect(screen.getByLabelText(/Deal Force damage/)).not.toBeChecked();
    });

    it('toggles the force damage checkbox when clicked', async () => {
      render(<PrimalCompanionBonusActionModal {...withForceDamage()} />);
      const checkbox = screen.getByLabelText(/Deal Force damage/);
      expect(checkbox).not.toBeChecked();
      await act(async () => { fireEvent.click(checkbox); });
      expect(checkbox).toBeChecked();
      await act(async () => { fireEvent.click(checkbox); });
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('apply flow', () => {
    it('does not call applyBonusActionCommand when no command is selected', async () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      expect(primalCompanionHandler.applyBonusActionCommand).not.toHaveBeenCalled();
    });

    it('calls applyBonusActionCommand with the selected command and useForceDamage=false', async () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      await act(async () => { fireEvent.click(screen.getByText('Help')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      expect(primalCompanionHandler.applyBonusActionCommand).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Primal Companion' }),
        expect.objectContaining({ name: 'Ranger1' }),
        'test-campaign',
        'Help',
        false,
      );
    });

    it('passes useForceDamage=true when the checkbox is checked', async () => {
      render(<PrimalCompanionBonusActionModal {...makeProps({
        action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: true } }
      })} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => { fireEvent.click(screen.getByLabelText(/Deal Force damage/)); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      expect(primalCompanionHandler.applyBonusActionCommand).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(String),
        'Dash',
        true,
      );
    });

    it('shows the result screen after a successful apply', async () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides the selection list and buttons after applying', async () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Command Companion/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('displays the result payload description in the body', async () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Commanded Wolf to take a Dash action');
      });
    });

    it('renders the result screen with proper CSS classes and header icon', async () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      await waitFor(() => {
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
        expect(document.querySelector('.sp-header .fa-hands')).toBeInTheDocument();
        expect(screen.getByText('Primal Companion')).toBeInTheDocument();
      });
    });

    it('calls onClose when Done button is clicked on the result screen', async () => {
      const onClose = vi.fn();
      render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay on the result screen', async () => {
      const onClose = vi.fn();
      render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
