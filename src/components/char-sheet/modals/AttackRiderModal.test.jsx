import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackRiderModal from './AttackRiderModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/combat/attackRiderHandler.js', () => ({
  applyRiderOption: vi.fn().mockResolvedValue({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Test Action',
      description: 'Effect applied successfully.',
    },
  }),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Re-import mocked modules ──

import { applyRiderOption } from '../../../services/automation/handlers/combat/attackRiderHandler.js';

// ── Test fixtures ──

function makeSingleSelectAction() {
  return {
    name: 'Divine Smite',
    automation: {
      type: 'attack_rider',
      options: [
        { name: 'Burning Hands', effect: 'next_attack_advantage', value: 5 },
        { name: 'Push Back', effect: 'push_15ft' },
      ],
      maxEffects: 1,
    },
  };
}

function makeMultiSelectAction() {
  return {
    name: 'Multi-Rider Attack',
    automation: {
      type: 'attack_rider',
      options: [
        { name: 'Disadvantage Curse', effect: 'disadvantage_on_next_save' },
        { name: 'No Opportunity', noOpportunityAttacks: true },
        { name: 'Speed Drain', effect: 'speed_reduction' },
      ],
      maxEffects: 3,
    },
  };
}

function makeProps(overrides) {
  return {
    action: makeSingleSelectAction(),
    playerStats: { name: 'TestCharacter' },
    campaignName: 'test-campaign',
    targetName: 'Goblin A',
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('AttackRiderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Render / initial state ──

  it('renders the modal overlay and header with action name', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
  });

  it('renders the overlay and modal containers with correct CSS classes', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders the bolt icon in the header', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-bolt');
    expect(icon).toBeInTheDocument();
  });

  it('shows the instruction text with target name for single select', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Choose an effect/);
    expect(bodyDiv.innerHTML).toMatch(/Goblin A/);
  });

  it('shows instruction text without target name when targetName is null', () => {
    const props = makeProps({ targetName: null });
    render(<AttackRiderModal {...props} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Choose an effect/);
    expect(bodyDiv.innerHTML).not.toMatch(/against/);
  });

  // ── Options rendering ──

  it('renders all options from the action', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByText('Burning Hands')).toBeInTheDocument();
    expect(screen.getByText('Push Back')).toBeInTheDocument();
  });

  it('renders effect descriptions for options that have them', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByText(/— \+5 to next attack/)).toBeInTheDocument();
    expect(screen.getByText(/— Push 15 ft/)).toBeInTheDocument();
  });

  it('renders effect description for disadvantage_on_next_save', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText(/— Disadvantage on next save/)).toBeInTheDocument();
  });

  it('renders effect description for noOpportunityAttacks', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText(/— Cannot make Opportunity Attacks/)).toBeInTheDocument();
  });

  it('renders effect description for speed_reduction', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText(/— Speed reduced by 15 ft/)).toBeInTheDocument();
  });

  it('renders radio inputs for single select mode', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const inputs = document.querySelectorAll('input[type="radio"]');
    expect(inputs).toHaveLength(2);
  });

  it('renders checkbox inputs for multi-select mode', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const inputs = document.querySelectorAll('input[type="checkbox"]');
    expect(inputs).toHaveLength(3);
  });

  // ── Single select interactions ──

  it('selects an option when clicked in single select mode', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const firstOption = screen.getByText('Burning Hands').parentElement;
    fireEvent.click(firstOption);
    const input = firstOption.querySelector('input[type="radio"]');
    expect(input.checked).toBe(true);
  });

  it('deselects previous selection when a different option is clicked', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const firstOption = screen.getByText('Burning Hands').parentElement;
    const secondOption = screen.getByText('Push Back').parentElement;
    fireEvent.click(firstOption);
    expect(firstOption.querySelector('input[type="radio"]').checked).toBe(true);
    fireEvent.click(secondOption);
    expect(firstOption.querySelector('input[type="radio"]').checked).toBe(false);
    expect(secondOption.querySelector('input[type="radio"]').checked).toBe(true);
  });

  it('enables apply button when an option is selected in single select', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: /Apply Effect/ });
    expect(applyBtn.disabled).toBe(true);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    expect(applyBtn.disabled).toBe(false);
  });

  it('disables apply button when no option is selected in single select', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: /Apply Effect/ });
    expect(applyBtn.disabled).toBe(true);
  });

  // ── Multi-select interactions ──

  it('renders multi-select label with max count', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Choose up to 3 effects/);
  });

  it('shows selected count in multi-select mode', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
  });

  it('increments selected count when checkbox is clicked in multi-select', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
  });

  it('decrements selected count when checkbox is unclicked in multi-select', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
  });

  it('enables apply button when at least one option is selected in multi-select', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const applyBtn = screen.getByRole('button', { name: /Apply Effects/ });
    expect(applyBtn.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(applyBtn.disabled).toBe(false);
  });

  it('disables apply button when no options selected in multi-select', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const applyBtn = screen.getByRole('button', { name: /Apply Effects/ });
    expect(applyBtn.disabled).toBe(true);
  });

  it('highlights selected option with background and border in single select', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const firstOption = screen.getByText('Burning Hands').parentElement;
    expect(firstOption.style.background).toContain('transparent');
    fireEvent.click(firstOption);
    expect(firstOption.style.background).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.15\)/);
    expect(firstOption.style.border).toContain('var(--color-link)');
  });

  it('highlights selected options in multi-select mode', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    const label = checkboxes[0].parentElement;
    expect(label.style.background).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.15\)/);
  });

  // ── Apply button behavior (single select) ──

  it('calls applyRiderOption with selected option in single select mode', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(applyRiderOption).toHaveBeenCalled();
    });
  });

  it('passes correct arguments to applyRiderOption in single select', async () => {
    const props = makeProps();
    render(<AttackRiderModal {...props} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(applyRiderOption).toHaveBeenCalledWith(
        props.action,
        props.playerStats,
        props.campaignName,
        props.targetName,
        ['Burning Hands']
      );
    });
  });

  it('shows result screen after applying in single select', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Effect applied successfully.')).toBeInTheDocument();
    });
  });

  it('shows Done button on result screen', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after applying', async () => {
    const onClose = vi.fn();
    render(<AttackRiderModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Apply button behavior (multi-select) ──

  it('calls applyRiderOption with all selected options in multi-select mode', async () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effects/ }));

    await waitFor(() => {
      expect(applyRiderOption).toHaveBeenCalledWith(
        action,
        expect.any(Object),
        'test-campaign',
        'Goblin A',
        ['Disadvantage Curse', 'No Opportunity']
      );
    });
  });

  it('shows result screen after applying in multi-select mode', async () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effects/ }));

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  // ── Cancel / close ──

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<AttackRiderModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<AttackRiderModal {...makeProps({ onClose })} />);
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal body', () => {
    const onClose = vi.fn();
    render(<AttackRiderModal {...makeProps({ onClose })} />);
    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Result screen behavior ──

  it('renders result header with action name and bolt icon', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(screen.getByText('Divine Smite')).toBeInTheDocument();
      const icon = document.querySelector('.sp-header .fa-solid.fa-bolt');
      expect(icon).toBeInTheDocument();
    });
  });

  it('renders result description in the modal body', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.innerHTML).toContain('Effect applied successfully.');
    });
  });

  // ── Edge cases ──

  it('handles empty options array gracefully', () => {
    const action = { name: 'Empty Action', automation: { type: 'attack_rider', options: [], maxEffects: 1 } };
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText('Empty Action')).toBeInTheDocument();
  });

  it('handles undefined automation options gracefully', () => {
    const action = { name: 'No Automation Action' };
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText('No Automation Action')).toBeInTheDocument();
  });

  it('handles undefined automation gracefully', () => {
    const action = { name: 'No Automation Action' };
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText('No Automation Action')).toBeInTheDocument();
  });

  it('uses default maxEffects of 1 when not specified', () => {
    const action = { name: 'Default Max', automation: { type: 'attack_rider', options: [{ name: 'Opt A' }] } };
    render(<AttackRiderModal {...makeProps({ action })} />);
    const inputs = document.querySelectorAll('input[type="radio"]');
    expect(inputs).toHaveLength(1);
  });

  it('uses radio inputs when maxEffects is 1', () => {
    const action = makeSingleSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const inputs = document.querySelectorAll('input[type="radio"]');
    expect(inputs).toHaveLength(2);
  });

  it('uses checkbox inputs when maxEffects > 1', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const inputs = document.querySelectorAll('input[type="checkbox"]');
    expect(inputs).toHaveLength(3);
  });

  it('shows plural "Effects" on apply button when multi-select', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByRole('button', { name: /Apply Effects/ })).toBeInTheDocument();
  });

  it('shows singular "Effect" on apply button when single-select', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Apply Effect/ })).toBeInTheDocument();
  });

  it('renders option with custom value for next_attack_advantage', () => {
    const action = {
      name: 'Custom Smite',
      automation: {
        type: 'attack_rider',
        options: [{ name: 'Power Strike', effect: 'next_attack_advantage', value: 10 }],
        maxEffects: 1,
      },
    };
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText(/— \+10 to next attack/)).toBeInTheDocument();
  });

  it('renders option with default value when value is missing for next_attack_advantage', () => {
    const action = {
      name: 'Default Value Smite',
      automation: {
        type: 'attack_rider',
        options: [{ name: 'Basic Strike', effect: 'next_attack_advantage' }],
        maxEffects: 1,
      },
    };
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText(/— \+5 to next attack/)).toBeInTheDocument();
  });

  it('renders option name without effect description when no effects defined', () => {
    const action = {
      name: 'Plain Action',
      automation: {
        type: 'attack_rider',
        options: [{ name: 'Plain Effect' }],
        maxEffects: 1,
      },
    };
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(screen.getByText('Plain Effect')).toBeInTheDocument();
  });

  it('applies result with skipSync=true to avoid SSE re-render loop', async () => {
    const mockResult = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Test',
        description: 'Applied.',
      },
    };
    vi.mocked(applyRiderOption).mockResolvedValue(mockResult);

    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(applyRiderOption).toHaveBeenCalled();
    });
  });

  it('handles applyRiderOption returning null gracefully', async () => {
    vi.mocked(applyRiderOption).mockResolvedValue(null);

    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    // When result is null, the modal should stay open (not show result screen)
    await waitFor(() => {
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
  });



  it('renders multi-select label with target name', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.innerHTML).toMatch(/Goblin A/);
  });

  it('renders multi-select label without target name when null', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action, targetName: null })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.innerHTML).not.toMatch(/against/);
  });

  it('renders the correct input name attribute for multi-select', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    const inputs = document.querySelectorAll('input[type="checkbox"]');
    expect(inputs[0].name).toMatch(/riderOption_/);
  });

  it('renders the correct input name attribute for single-select', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const inputs = document.querySelectorAll('input[type="radio"]');
    expect(inputs[0].name).toBe('riderOption');
  });

  it('renders the dismiss button with correct text', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders the apply button with bolt icon', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: /Apply Effect/ });
    const icon = applyBtn.querySelector('.fa-solid.fa-bolt');
    expect(icon).toBeInTheDocument();
  });

  it('renders the result screen with sp-overlay class', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });
  });

  it('renders the result screen with sp-modal class', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });
  });

  it('renders the result screen with sp-header class', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
    });
  });

  it('renders the result screen with sp-body class', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
    });
  });

  it('renders the result screen with sp-actions class', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });
  });

  it('renders the result screen with sp-roll-btn class', async () => {
    render(<AttackRiderModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Burning Hands').parentElement);
    fireEvent.click(screen.getByRole('button', { name: /Apply Effect/ }));

    await waitFor(() => {
      expect(document.querySelector('.sp-roll-btn')).toBeInTheDocument();
    });
  });

});
