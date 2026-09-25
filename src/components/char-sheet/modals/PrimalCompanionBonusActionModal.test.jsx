// @improved-by-ai
// @cleaned-by-ai
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

  // ── Initial render ──

  describe('initial render', () => {
    it('renders the header with action name and Font Awesome hands icon', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      expect(screen.getByText('Primal Companion')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-hands')).toBeInTheDocument();
    });

    it('renders all four bonus action command options with descriptions', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      const body = document.querySelector('.sp-body');
      expect(screen.getByText('Primal Companion')).toBeInTheDocument();
      expect(screen.getByText('Dash')).toBeInTheDocument();
      expect(screen.getByText('Disengage')).toBeInTheDocument();
      expect(screen.getByText('Dodge')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
      expect(body.textContent).toContain('Command your');
      expect(body.textContent).toContain('Wolf');
      expect(body.textContent).toContain('to take a Bonus Action');
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

    it('closes on Cancel button click', () => {
      const onClose = vi.fn();
      render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking the overlay on initial render', () => {
      const onClose = vi.fn();
      render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('does not close when clicking inside the modal content', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(baseProps.onClose).not.toHaveBeenCalled();
    });

    it('does not close when clicking a command option', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Dash'));
      expect(baseProps.onClose).not.toHaveBeenCalled();
    });
  });

  // ── Command selection ──

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


  });

  // ── Force damage option ──

  describe('force damage option', () => {
    const withForceDamage = (overrides = {}) => makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: true } },
      ...overrides,
    });

    it('renders the force damage checkbox when forceDamageOption is true', () => {
      render(<PrimalCompanionBonusActionModal {...withForceDamage()} />);
      expect(screen.getByLabelText(/Deal Force damage/)).toBeInTheDocument();
    });

    it('does not render the force damage checkbox when forceDamageOption is absent', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps({
        action: { name: 'Primal Companion', automation: { type: 'bonus_action' } }
      })} />);
      expect(screen.queryByLabelText(/Deal Force damage/)).not.toBeInTheDocument();
    });

    it('does not render the force damage checkbox when forceDamageOption is false', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps({
        action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: false } }
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

  // ── Apply flow ──

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

    it('shows the result screen after a successful apply and closes on Done button', async () => {
      const onClose = vi.fn();
      render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Commanded Wolf to take a Dash action');
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders result description as HTML when it contains HTML tags', async () => {
      vi.mocked(primalCompanionHandler.applyBonusActionCommand).mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Primal Companion',
          description: '<b>Commanded Wolf</b> to take a Dash action.',
        },
      });
      render(<PrimalCompanionBonusActionModal {...makeProps()} />);
      await act(async () => { fireEvent.click(screen.getByText('Dash')); });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.querySelector('b')).toBeInTheDocument();
      });
    });
  });

  // ── Null safety ──

  describe('null safety', () => {
    it('renders with empty companionType', () => {
      render(<PrimalCompanionBonusActionModal {...makeProps({ companionType: '' })} />);
      expect(screen.getByText('Primal Companion')).toBeInTheDocument();
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Command your');
    });
  });
});
