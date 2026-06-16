import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PrimalCompanionBonusActionModal from './PrimalCompanionBonusActionModal.jsx';

// ── Mocked modules ──

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

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 'Wolf'),
  setRuntimeValue: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as primalCompanionHandler from '../../../services/automation/handlers/class-ranger/primalCompanionHandler.js';

// ── Test fixtures ──

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
  return { ...baseProps, ...(overrides || {}) }
}

// ── Tests ──

describe('PrimalCompanionBonusActionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal container', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders modal header with action name', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(screen.getByText('Primal Companion')).toBeInTheDocument();
  });

  it('renders Font Awesome hands icon in header', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(document.querySelector('.fa-hands')).toBeInTheDocument();
  });

  it('displays companion type instruction text', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    const body = document.querySelector('.sp-body p');
    expect(body.textContent).toContain('Command your');
    expect(body.textContent).toContain('Wolf');
    expect(body.textContent).toContain('to take a Bonus Action');
  });

  it('renders all four bonus action command options', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(screen.getByText('Dash')).toBeInTheDocument();
    expect(screen.getByText('Disengage')).toBeInTheDocument();
    expect(screen.getByText('Dodge')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('renders descriptions for all bonus action commands', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Double movement speed this turn');
    expect(body.textContent).toContain("Movement doesn't trigger opportunity attacks");
    expect(body.textContent).toContain('Attackers have disadvantage against the companion');
    expect(body.textContent).toContain('Next ally attack against a target has advantage');
  });

  it('does not select any command by default', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => expect(radio.checked).toBe(false));
  });

  it('renders Command Companion button disabled by default', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    const submitBtn = screen.getByRole('button', { name: /Command Companion/ });
    expect(submitBtn).toBeDisabled();
  });

  it('renders Cancel button', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Font Awesome hands icon on Command Companion button', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(document.querySelector('.sp-roll-btn .fa-hands')).toBeInTheDocument();
  });

  it('does not render force damage option when not enabled', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(screen.queryByText(/Deal Force damage/)).not.toBeInTheDocument();
  });

  // ── Overlay click behavior ──

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

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Radio selection ──

  it('selects Dash when clicked', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    const dashLabel = screen.getByText('Dash').closest('label');
    expect(dashLabel.querySelector('input')).toBeChecked();
  });

  it('selects Disengage when clicked', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Disengage'));
    });
    const disengageLabel = screen.getByText('Disengage').closest('label');
    expect(disengageLabel.querySelector('input')).toBeChecked();
  });

  it('selects Dodge when clicked', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dodge'));
    });
    const dodgeLabel = screen.getByText('Dodge').closest('label');
    expect(dodgeLabel.querySelector('input')).toBeChecked();
  });

  it('selects Help when clicked', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Help'));
    });
    const helpLabel = screen.getByText('Help').closest('label');
    expect(helpLabel.querySelector('input')).toBeChecked();
  });

  it('enables Command Companion button after selecting a command', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    const submitBtn = screen.getByRole('button', { name: /Command Companion/ });
    expect(submitBtn).toBeDisabled();
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    expect(submitBtn).toBeEnabled();
  });

  it('switches selection when clicking a different command', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    const dashLabel = screen.getByText('Dash').closest('label');
    expect(dashLabel.querySelector('input')).toBeChecked();
    await act(async () => {
      fireEvent.click(screen.getByText('Disengage'));
    });
    const dashLabel2 = screen.getByText('Dash').closest('label');
    expect(dashLabel2.querySelector('input')).not.toBeChecked();
    const disengageLabel = screen.getByText('Disengage').closest('label');
    expect(disengageLabel.querySelector('input')).toBeChecked();
  });

  // ── Force damage option ──

  it('renders force damage checkbox when forceDamageOption is true', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: true } }
    })} />);
    expect(screen.getByLabelText(/Deal Force damage/)).toBeInTheDocument();
  });

  it('does not render force damage checkbox when forceDamageOption is false', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: false } }
    })} />);
    expect(screen.queryByLabelText(/Deal Force damage/)).not.toBeInTheDocument();
  });

  it('does not render force damage checkbox when forceDamageOption is undefined', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action' } }
    })} />);
    expect(screen.queryByLabelText(/Deal Force damage/)).not.toBeInTheDocument();
  });

  it('defaults force damage checkbox to unchecked', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: true } }
    })} />);
    expect(screen.getByLabelText(/Deal Force damage/)).not.toBeChecked();
  });

  it('toggles force damage checkbox when clicked', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: true } }
    })} />);
    const checkbox = screen.getByLabelText(/Deal Force damage/);
    expect(checkbox).not.toBeChecked();
    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(checkbox).toBeChecked();
    await act(async () => {
      fireEvent.click(checkbox);
    });
    expect(checkbox).not.toBeChecked();
  });

  // ── Apply / result flow ──

  it('does not call applyBonusActionCommand without selecting a command', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    expect(primalCompanionHandler.applyBonusActionCommand).not.toHaveBeenCalled();
  });

  it('calls applyBonusActionCommand after selecting a command and clicking apply', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    expect(primalCompanionHandler.applyBonusActionCommand).toHaveBeenCalledTimes(1);
  });

  it('passes selected command to applyBonusActionCommand', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Help'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    expect(primalCompanionHandler.applyBonusActionCommand).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Primal Companion' }),
      expect.objectContaining({ name: 'Ranger1' }),
      'test-campaign',
      'Help',
      false
    );
  });

  it('passes useForceDamage=false when checkbox is unchecked', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: true } }
    })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    expect(primalCompanionHandler.applyBonusActionCommand).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(String),
      'Dash',
      false
    );
  });

  it('passes useForceDamage=true when checkbox is checked', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps({
      action: { name: 'Primal Companion', automation: { type: 'bonus_action', forceDamageOption: true } }
    })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/Deal Force damage/));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    expect(primalCompanionHandler.applyBonusActionCommand).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(String),
      'Dash',
      true
    );
  });

  it('shows result screen after successful apply', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides selection list after applying', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Command Companion/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('displays result payload description', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Commanded Wolf to take a Dash action');
    });
  });

  it('displays result header with action name', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Primal Companion')).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after apply', async () => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking overlay on result screen', async () => {
    const onClose = vi.fn();
    render(<PrimalCompanionBonusActionModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Font Awesome hands icon on result screen header', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-header .fa-hands')).toBeInTheDocument();
    });
  });

  // ── CSS classes ──

  it('renders modal with proper CSS classes on initial render', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders modal with proper CSS classes on result screen', async () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByText('Dash'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Command Companion/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });
  });

  // ── Modal body content ──

  it('renders radio inputs with correct name attribute', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => expect(radio.name).toBe('primalCompanionBonusAction'));
  });

  it('renders 4 radio inputs for 4 commands', () => {
    render(<PrimalCompanionBonusActionModal {...makeProps()} />);
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(4);
  });
});
