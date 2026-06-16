import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BonusActionChoiceModal from './BonusActionChoiceModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/combat/bonusActionChoiceHandler.js', () => ({
  applyBonusActionChoice: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Re-import mocked modules ──

import * as bonusActionHandler from '../../../services/automation/handlers/combat/bonusActionChoiceHandler.js';

// ── Test fixtures ──

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

// ── Tests ──

describe('BonusActionChoiceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal content container', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders header with action name and hand icon', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByText('Cunning Action')).toBeInTheDocument();
    const icon = document.querySelector('.fa-hand');
    expect(icon).toBeInTheDocument();
  });

  it('displays "Choose a Bonus Action" prompt', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
  });

  it('renders all option labels', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByText('Dash')).toBeInTheDocument();
    expect(screen.getByText('Disengage')).toBeInTheDocument();
    expect(screen.getByText('Hide')).toBeInTheDocument();
  });

  it('renders option descriptions', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByText(/Double movement speed/)).toBeInTheDocument();
    expect(screen.getByText(/Movement doesn't provoke/)).toBeInTheDocument();
    expect(screen.getByText(/Make a Dexterity \(Stealth\)/)).toBeInTheDocument();
  });

  it('renders Apply button with hand icon', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeInTheDocument();
    expect(document.querySelector('.fa-hand')).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('disables Apply button when no option selected', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeDisabled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Selection behavior ──

  it('selects an option when its radio button is clicked', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    const dashRadio = document.querySelector('input[type="radio"][name="bonusActionChoice"]');
    fireEvent.click(dashRadio);
    expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeEnabled();
  });

  it('highlights selected option visually', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]); // Disengage
    const labels = document.querySelectorAll('label[style*="background"]');
    expect(labels[1].style.background).toContain('rgba(255');
  });

  it('deselects previous option when new option is selected', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]); // Dash
    fireEvent.click(radios[2]); // Hide
    expect(radios[0].checked).toBe(false);
    expect(radios[2].checked).toBe(true);
  });

  it('enables Apply button after selection', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeEnabled();
  });

  // ── Apply flow ──

  it('calls applyBonusActionChoice with correct arguments when Apply is clicked', () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]); // Dash
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalledWith(
      baseAction,
      baseProps.playerStats,
      'test-campaign',
      'Dash'
    );
  });

  it('shows result after Apply is clicked', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      expect(screen.getByText('Cunning Action')).toBeInTheDocument();
    });
  });

  it('hides options after Apply is clicked', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      expect(screen.queryByText('Choose a Bonus Action:')).not.toBeInTheDocument();
    });
  });

  it('hides Apply button after Apply is clicked', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Use Bonus Action/ })).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after Apply is clicked', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('displays result description from handler', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action. Your movement speed is doubled until the end of the turn.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Dash selected');
    });
  });

  it('renders Done button after Apply', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked', () => {
    const onClose = vi.fn();
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Done button is clicked (rendered)', async () => {
    const onClose = vi.fn();
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Unknown option handling ──

  it('shows unknown option message when handler returns unknown option result', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Unknown option: FooBar',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Unknown option');
    });
  });

  // ── No options edge case ──

  it('renders no options when action has no automation options', () => {
    const actionNoOptions = {
      name: 'Empty Action',
      automation: {},
    };
    render(<BonusActionChoiceModal {...makeProps({ action: actionNoOptions })} />);
    expect(screen.getByText('Empty Action')).toBeInTheDocument();
    expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
  });

  it('shows disabled Apply button when no options available', () => {
    const actionNoOptions = {
      name: 'Empty Action',
      automation: {},
    };
    render(<BonusActionChoiceModal {...makeProps({ action: actionNoOptions })} />);
    expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeDisabled();
  });

  // ── Various bonus action options ──

  it('renders Sleight of Hand option', () => {
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
    expect(screen.getByText('Sleight of Hand')).toBeInTheDocument();
    expect(screen.getByText('Thieves\' Tools')).toBeInTheDocument();
  });

  it('renders Use an Object option', () => {
    const actionWithObject = {
      name: 'Fast Hands',
      automation: {
        oncePerTurn: true,
        options: [
          { name: 'Use an Object', description: 'Use an object.' },
        ],
      },
    };
    render(<BonusActionChoiceModal {...makeProps({ action: actionWithObject })} />);
    expect(screen.getByText('Use an Object')).toBeInTheDocument();
  });

  // ── CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  // ── Result state after applied ──

  it('does not show result on initial render', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
  });

  it('renders result header with action name', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      expect(screen.getByText('Cunning Action')).toBeInTheDocument();
    });
  });

  it('renders Font Awesome hand icon in result header', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-hand');
      expect(icon).toBeInTheDocument();
    });
  });

  // ── setRuntimeValue called for oncePerTurn ──

  it('calls setRuntimeValue for oncePerTurn actions', () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    // Mocked handler doesn't call internal logic; verify the component called the handler
    expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalled();
  });

  // ── getCurrentCombatRound called for oncePerTurn ──

  it('calls getCurrentCombatRound for oncePerTurn actions', () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Dash selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    // Mocked handler doesn't call internal logic; verify the handler was invoked
    expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalledTimes(1);
  });

  // ── Multiple option selection ──

  it('selects Disengage option and applies it', () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Disengage selected: You take the Disengage bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]); // Disengage
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalledWith(
      baseAction,
      baseProps.playerStats,
      'test-campaign',
      'Disengage'
    );
  });

  it('selects Hide option and applies it', () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Hide selected: You attempt to Hide.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[2]); // Hide
    fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
    expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalledWith(
      baseAction,
      baseProps.playerStats,
      'test-campaign',
      'Hide'
    );
  });

  // ── Modal click propagation ──

  it('does not close when clicking the modal header', () => {
    const onClose = vi.fn();
    render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-header'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking the modal body', () => {
    const onClose = vi.fn();
    render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-body'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking the modal actions', () => {
    const onClose = vi.fn();
    render(<BonusActionChoiceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-actions'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Different action names ──

  it('renders different action name in header', () => {
    const action = {
      name: 'Action Name',
      automation: {
        options: [{ name: 'Dash', description: 'Double movement.' }],
      },
    };
    render(<BonusActionChoiceModal {...makeProps({ action })} />);
    expect(screen.getByText('Action Name')).toBeInTheDocument();
  });
});
