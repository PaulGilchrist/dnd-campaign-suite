// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BonusActionChoiceModal from './BonusActionChoiceModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js', () => ({
  applyBonusActionChoice: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Re-import mocked modules ──

import * as bonusActionHandler from '../../../../services/automation/handlers/combat/bonusActionChoiceHandler.js';

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

function selectOption(index) {
  const radios = document.querySelectorAll('input[type="radio"]');
  fireEvent.click(radios[index]);
}

function clickApply() {
  fireEvent.click(screen.getByRole('button', { name: /Use Bonus Action/ }));
}

function clickDone() {
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}

// ── Tests ──

describe('BonusActionChoiceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal with action name, prompt text, options, and buttons', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByText('Cunning Action')).toBeInTheDocument();
    expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
    expect(screen.getByText('Dash')).toBeInTheDocument();
    expect(screen.getByText('Disengage')).toBeInTheDocument();
    expect(screen.getByText('Hide')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('disables Apply button when no option is selected', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeDisabled();
  });

  it('does not show result state on initial render', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    expect(screen.getByText('Choose a Bonus Action:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // ── Selection behavior ──

  it('selects an option when its radio is clicked and enables Apply', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    selectOption(0);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios[0].checked).toBe(true);
    expect(screen.getByRole('button', { name: /Use Bonus Action/ })).toBeEnabled();
  });

  it('applies selected style to the chosen option label', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    const labels = document.querySelectorAll('label');
    expect(labels[0].style.border).toBe('1px solid transparent');
    selectOption(0);
    expect(labels[0].style.border).toContain('var(--color-link)');
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
    selectOption(0);
    clickApply();
    expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalledWith(
      baseAction,
      baseProps.playerStats,
      'test-campaign',
      'Dash'
    );
  });

  it('does not call handler when Apply is clicked with no selection', () => {
    render(<BonusActionChoiceModal {...makeProps()} />);
    clickApply();
    expect(bonusActionHandler.applyBonusActionChoice).not.toHaveBeenCalled();
  });

  it('shows result and Done button after Apply, hides selection and Cancel', async () => {
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
    selectOption(0);
    clickApply();
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Dash selected');
      expect(screen.queryByText('Choose a Bonus Action:')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Use Bonus Action/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toHaveClass('sp-roll-btn');
    });
  });

  it('renders result description as HTML via dangerouslySetInnerHTML', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: '<strong>Dash</strong> selected: You take the Dash bonus action.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    selectOption(0);
    clickApply();
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.innerHTML).toContain('<strong>Dash</strong>');
    });
  });

  it('calls onClose when Done button or overlay is clicked in applied state', async () => {
    const onClose = vi.fn();
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
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
    clickApply();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    clickDone();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside modal in applied state', async () => {
    const onClose = vi.fn();
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
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
    clickApply();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Different option selection ──

  it('passes different option names to handler when selected', () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Cunning Action',
        description: 'Disengage selected.',
        automation: baseAction.automation,
      },
    });
    render(<BonusActionChoiceModal {...makeProps()} />);
    selectOption(1);
    clickApply();
    expect(bonusActionHandler.applyBonusActionChoice).toHaveBeenCalledWith(
      baseAction,
      baseProps.playerStats,
      'test-campaign',
      'Disengage'
    );
  });

  // ── Edge cases: missing/empty options ──

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

  // ── Different action types ──

  it('renders custom action options (Fast Hands, Use an Object, Misty Step)', () => {
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
  });

  it('renders Use an Object option', () => {
    const actionWithObject = {
      name: 'Object Action',
      automation: {
        options: [{ name: 'Use an Object', description: 'Use an object.' }],
      },
    };
    render(<BonusActionChoiceModal {...makeProps({ action: actionWithObject })} />);
    expect(screen.getByText('Use an Object')).toBeInTheDocument();
    expect(screen.getByText(/Use an object/)).toBeInTheDocument();
  });

  it('renders a different action name in the header', () => {
    const action = {
      name: 'Misty Step',
      automation: {
        options: [{ name: 'Cast Misty Step', description: 'Teleport up to 30 feet.' }],
      },
    };
    render(<BonusActionChoiceModal {...makeProps({ action })} />);
    expect(screen.getByText('Misty Step')).toBeInTheDocument();
  });

  // ── Handler return value edge cases ──

  it('displays handler result description including unknown option messages', async () => {
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
    selectOption(0);
    clickApply();
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Unknown option');
    });
  });

  it('does not show applied state when handler returns null', async () => {
    bonusActionHandler.applyBonusActionChoice.mockReturnValue(null);
    render(<BonusActionChoiceModal {...makeProps()} />);
    selectOption(0);
    clickApply();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Fast Hands internal skill-check events ──

  it('dispatches internal-skill-check event for Sleight of Hand', async () => {
    const customEventSpy = vi.spyOn(window, 'dispatchEvent');
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
    bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fast Hands',
        description: 'Sleight of Hand selected: You use Fast Hands to make a Dexterity (Sleight of Hand) check.',
        automation: actionWithSleight.automation,
      },
    });
    const props = makeProps({
      action: actionWithSleight,
      playerStats: {
        name: 'Rogue1',
        level: 3,
        skills: [{ name: 'Sleight of Hand', bonus: 5 }],
        abilities: [{ name: 'Dexterity', bonus: 3 }],
        proficiency: 2,
      },
    });
    render(<BonusActionChoiceModal {...props} />);
    selectOption(0);
    clickApply();
    await waitFor(() => {
      expect(customEventSpy).toHaveBeenCalled();
      const event = customEventSpy.mock.calls[0][0];
      expect(event.type).toBe('internal-skill-check');
      expect(event.detail.skillName).toBe('Sleight of Hand');
      expect(event.detail.checkType).toBe('skill');
    });
    customEventSpy.mockRestore();
  });

  it('dispatches internal-skill-check event for Thieves\' Tools', async () => {
    const customEventSpy = vi.spyOn(window, 'dispatchEvent');
    const actionWithTools = {
      name: 'Fast Hands',
      automation: {
        oncePerTurn: true,
        options: [
          { name: 'Sleight of Hand', description: 'Make a Sleight of Hand check.' },
          { name: 'Thieves\' Tools', description: 'Use thieves\' tools.' },
        ],
      },
    };
    bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fast Hands',
        description: "Thieves' Tools selected: You use Fast Hands to use thieves' tools to pick a lock or disarm a trap.",
        automation: actionWithTools.automation,
      },
    });
    const props = makeProps({
      action: actionWithTools,
      playerStats: {
        name: 'Rogue1',
        level: 3,
        skills: [{ name: 'Sleight of Hand', bonus: 5 }],
        abilities: [{ name: 'Dexterity', bonus: 3 }],
        proficiency: 2,
        proficiencies: { thievesTools: true },
      },
    });
    render(<BonusActionChoiceModal {...props} />);
    selectOption(1);
    clickApply();
    await waitFor(() => {
      expect(customEventSpy).toHaveBeenCalled();
      const event = customEventSpy.mock.calls[0][0];
      expect(event.type).toBe('internal-skill-check');
      expect(event.detail.skillName).toBe('Thieves\' Tools');
      expect(event.detail.checkType).toBe('check');
    });
    customEventSpy.mockRestore();
  });

  it('does not dispatch event when Use an Object is selected', async () => {
    const customEventSpy = vi.spyOn(window, 'dispatchEvent');
    const actionWithObject = {
      name: 'Fast Hands',
      automation: {
        oncePerTurn: true,
        options: [
          { name: 'Sleight of Hand', description: 'Make a Sleight of Hand check.' },
          { name: 'Thieves\' Tools', description: 'Use thieves\' tools.' },
          { name: 'Use an Object', description: 'Use an object.' },
        ],
      },
    };
    bonusActionHandler.applyBonusActionChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fast Hands',
        description: 'Use an Object selected: You use Fast Hands to use an object.',
        automation: actionWithObject.automation,
      },
    });
    const props = makeProps({
      action: actionWithObject,
      playerStats: {
        name: 'Rogue1',
        level: 3,
        skills: [{ name: 'Sleight of Hand', bonus: 5 }],
        abilities: [{ name: 'Dexterity', bonus: 3 }],
        proficiency: 2,
      },
    });
    render(<BonusActionChoiceModal {...props} />);
    selectOption(2);
    clickApply();
    await waitFor(() => {
      expect(customEventSpy).not.toHaveBeenCalled();
    });
    customEventSpy.mockRestore();
  });
});
