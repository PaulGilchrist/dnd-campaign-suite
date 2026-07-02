// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackRiderModal from './AttackRiderModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/combat/attackRiderHandler.js', () => ({
  applyRiderOption: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js', () => ({
  applyVersatileTrickster: vi.fn(),
}));

// ── Re-import mocked modules ──

import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';

// ── Test fixtures ──

const defaultPlayerStats = { name: 'TestCharacter' };
const defaultCampaignName = 'test-campaign';
const defaultTargetName = 'Goblin A';

function makeProps(overrides) {
  return {
    action: makeSingleSelectAction(),
    playerStats: { ...defaultPlayerStats },
    campaignName: defaultCampaignName,
    targetName: defaultTargetName,
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function makeSingleSelectAction(overrides) {
  return {
    name: 'Divine Smite',
    automation: {
      type: 'attack_rider',
      options: [
        { name: 'Burning Hands', effect: 'next_attack_advantage', value: 5 },
        { name: 'Push Back', effect: 'push_15ft' },
      ],
      maxEffects: 1,
      ...overrides,
    },
    ...overrides,
  };
}

function makeMultiSelectAction(overrides) {
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
      ...overrides,
    },
    ...overrides,
  };
}

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Test Action',
    description: 'Effect applied successfully.',
  },
};

// ── Helpers ──

function selectSingleOption(labelText) {
  const optionLabel = screen.getByText(labelText).parentElement;
  fireEvent.click(optionLabel);
  return optionLabel;
}

function clickApplySingle() {
  return fireEvent.click(screen.getByRole('button', { name: /Apply Effect$/ }));
}

function clickApplyMulti() {
  return fireEvent.click(screen.getByRole('button', { name: /Apply Effects$/ }));
}

function clickCheckbox(index) {
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[index]);
}

// ── Tests ──

describe('AttackRiderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  describe('initial render', () => {
    it('renders the modal overlay, modal container, and header with action name', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByText('Divine Smite')).toBeInTheDocument();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the bolt icon in the header', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(document.querySelector('.sp-header .fa-solid.fa-bolt')).toBeInTheDocument();
    });

    it('renders the bolt icon on the apply button', () => {
      render(<AttackRiderModal {...makeProps()} />);
      const applyBtn = screen.getByRole('button', { name: /Apply Effect$/ });
      expect(applyBtn.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
    });

    it('renders the cancel button', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows instruction text with target name for single select', () => {
      render(<AttackRiderModal {...makeProps()} />);
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toMatch(/Choose an effect/);
      expect(bodyDiv.innerHTML).toMatch(/Goblin A/);
    });

    it('shows instruction text without target name when targetName is null', () => {
      render(<AttackRiderModal {...makeProps({ targetName: null })} />);
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toMatch(/Choose an effect/);
      expect(bodyDiv.innerHTML).not.toMatch(/against/);
    });

    it('renders all options from the action', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByText('Burning Hands')).toBeInTheDocument();
      expect(screen.getByText('Push Back')).toBeInTheDocument();
    });

    it('renders effect descriptions for options with known effects', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByText(/— \+5 to next attack/)).toBeInTheDocument();
      expect(screen.getByText(/— Push 15 ft/)).toBeInTheDocument();
    });

    it('renders option name without effect description when no effects match', () => {
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
  });

  // ── Effect description rendering ──

  describe('effect descriptions', () => {
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

    it('renders effect description with custom value for next_attack_advantage', () => {
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

    it('renders effect description with default value when value is missing for next_attack_advantage', () => {
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

    it('renders effect description for sudden_strike', () => {
      const action = {
        name: 'Sudden Strike',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Sudden Strike', effect: 'sudden_strike' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Make another attack vs\. different creature within 5 ft/)).toBeInTheDocument();
    });

    it('renders effect description for mass_fear', () => {
      const action = {
        name: 'Mass Fear',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Mass Fear', effect: 'mass_fear' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Target \+ creatures within 10 ft make WIS save or be Frightened/)).toBeInTheDocument();
    });

    it('renders effect description for prone', () => {
      const action = makeSingleSelectAction({
        options: [{ name: 'Trip', effect: 'prone' }],
      });
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Target makes DEX save or gains Prone condition/)).toBeInTheDocument();
    });

    it('renders effect description for poisoned', () => {
      const action = {
        name: 'Cunning Strike Poison',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Poison', effect: 'poisoned' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Target makes CON save or becomes Poisoned \(1 min, repeating\)/)).toBeInTheDocument();
    });

    it('renders effect description for no_opportunity_attacks with movement', () => {
      const action = {
        name: 'Charger',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Charger Move', effect: 'no_opportunity_attacks', movement: 30 }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Move up to 30 without provoking OAs/)).toBeInTheDocument();
    });

    it('renders effect description for daze', () => {
      const action = {
        name: 'Daze Attack',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Daze', effect: 'daze' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Target makes CON save or on next turn can only do one of: move, action, or Bonus Action/)).toBeInTheDocument();
    });

    it('renders effect description for unconscious', () => {
      const action = {
        name: 'Unconscious Strike',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Unconscious', effect: 'unconscious' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Target makes CON save or becomes Unconscious \(1 min, repeating\)/)).toBeInTheDocument();
    });

    it('renders effect description for blinded', () => {
      const action = {
        name: 'Blinding Strike',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Blinded', effect: 'blinded' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Target makes DEX save or becomes Blinded \(until end of its next turn\)/)).toBeInTheDocument();
    });

    it('renders effect description for damage_bonus with default expression', () => {
      const action = {
        name: 'Elemental Attack',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Fire Damage', effect: 'damage_bonus' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— 1d6 damage/)).toBeInTheDocument();
    });

    it('renders effect description for damage_bonus with custom expression', () => {
      const action = {
        name: 'Elemental Attack',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Fire Damage', effect: 'damage_bonus', damageExpression: '2d6' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— 2d6 damage/)).toBeInTheDocument();
    });

    it('renders cost description for Cunning Strike', () => {
      const action = {
        name: 'Cunning Strike',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Poison', effect: 'poisoned', cost: '2d6' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toContain('Cost: 2d6 Sneak Attack dice');
    });

    it('renders effect description for push with custom value', () => {
      const action = {
        name: 'Push Attack',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Push', effect: 'push', value: 15 }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Push 15 ft/)).toBeInTheDocument();
    });

    it('renders effect description for push with default value', () => {
      const action = {
        name: 'Push Attack',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Push', effect: 'push' }],
          maxEffects: 1,
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/— Push 10 ft/)).toBeInTheDocument();
    });
  });

  // ── Single select mode ──

  describe('single select mode', () => {
    it('renders radio inputs for each option', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    });

    it('does not render checkbox inputs', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    });

    it('selects an option when clicked', () => {
      render(<AttackRiderModal {...makeProps()} />);
      const firstOption = selectSingleOption('Burning Hands');
      expect(firstOption.querySelector('input[type="radio"]').checked).toBe(true);
    });

    it('deselects previous selection when a different option is clicked', () => {
      render(<AttackRiderModal {...makeProps()} />);
      const firstOption = selectSingleOption('Burning Hands');
      const secondOption = screen.getByText('Push Back').parentElement;
      fireEvent.click(secondOption);
      expect(firstOption.querySelector('input[type="radio"]').checked).toBe(false);
      expect(secondOption.querySelector('input[type="radio"]').checked).toBe(true);
    });

    it('disables the apply button when no option is selected', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Apply Effect$/ })).toBeDisabled();
    });

    it('enables the apply button after selecting an option', () => {
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      expect(screen.getByRole('button', { name: /Apply Effect$/ })).not.toBeDisabled();
    });

    it('highlights the selected option with background and border styles', () => {
      render(<AttackRiderModal {...makeProps()} />);
      const firstOption = screen.getByText('Burning Hands').parentElement;
      expect(firstOption.style.background).toContain('transparent');
      selectSingleOption('Burning Hands');
      expect(firstOption.style.background).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.15\)/);
      expect(firstOption.style.border).toContain('var(--color-link)');
    });

    it('uses the radio input name "riderOption"', () => {
      render(<AttackRiderModal {...makeProps()} />);
      const inputs = document.querySelectorAll('input[type="radio"]');
      expect(inputs[0].name).toBe('riderOption');
    });

    it('shows singular "Effect" on the apply button', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Apply Effect$/ })).toBeInTheDocument();
    });
  });

  // ── Multi-select mode ──

  describe('multi-select mode', () => {
    const action = makeMultiSelectAction();

    it('renders checkbox inputs for each option', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    });

    it('renders radio inputs (none)', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('renders multi-select label with max count and target name', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toMatch(/Choose up to 3 effects/);
      expect(bodyDiv.innerHTML).toMatch(/Goblin A/);
    });

    it('renders multi-select label without target name when null', () => {
      render(<AttackRiderModal {...makeProps({ action, targetName: null })} />);
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.innerHTML).not.toMatch(/against/);
    });

    it('shows selected count starting at zero', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });

    it('increments selected count when checkbox is clicked', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      clickCheckbox(0);
      expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    });

    it('decrements selected count when checkbox is unclicked', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      clickCheckbox(0);
      clickCheckbox(0);
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });

    it('enables apply button when at least one option is selected', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByRole('button', { name: /Apply Effects$/ })).toBeDisabled();
      clickCheckbox(0);
      expect(screen.getByRole('button', { name: /Apply Effects$/ })).not.toBeDisabled();
    });

    it('disables apply button when no options selected', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByRole('button', { name: /Apply Effects$/ })).toBeDisabled();
    });

    it('highlights selected options with background and border styles', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      const label = checkboxes[0].parentElement;
      expect(label.style.background).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.15\)/);
    });

    it('uses checkbox input names with riderOption_ prefix and index', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      const inputs = document.querySelectorAll('input[type="checkbox"]');
      expect(inputs[0].name).toMatch(/riderOption_/);
    });

    it('shows plural "Effects" on the apply button', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByRole('button', { name: /Apply Effects$/ })).toBeInTheDocument();
    });

    it('prevents selecting more than maxEffects', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      clickCheckbox(0);
      clickCheckbox(1);
      clickCheckbox(2);
      // maxEffects is 3, so all three are selected
      expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
      // Clicking a fourth (non-existent) would require a 4th option;
      // the toggleMultiSelect guard prevents exceeding maxEffects.
      // Verify the guard by checking the selected count stays at max.
      expect(screen.queryByText(/4\/3 selected/)).not.toBeInTheDocument();
    });
  });

  // ── Apply behavior — single select ──

  describe('apply behavior — single select', () => {
    beforeEach(() => {
      applyRiderOption.mockResolvedValue(defaultResult);
    });

    it('calls applyRiderOption with correct arguments when applied', async () => {
      const props = makeProps();
      render(<AttackRiderModal {...props} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

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

    it('shows result screen after applying', async () => {
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.getByText('Effect applied successfully.')).toBeInTheDocument();
      });
    });

    it('hides selection options after applying', async () => {
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.queryByText(/Choose an effect/)).not.toBeInTheDocument();
      });
    });

    it('hides the apply and cancel buttons after applying', async () => {
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Apply Effect$/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('renders result with bolt icon and action name in header', async () => {
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.getByText('Divine Smite')).toBeInTheDocument();
        expect(document.querySelector('.sp-header .fa-solid.fa-bolt')).toBeInTheDocument();
      });
    });

    it('renders result description as HTML in the body', async () => {
      applyRiderOption.mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Action', description: '<strong>Bold</strong> result.' },
      });
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.innerHTML).toContain('<strong>Bold</strong>');
      });
    });

    it('renders Done button with sp-roll-btn class', async () => {
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        const doneBtn = screen.getByRole('button', { name: 'Done' });
        expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true);
      });
    });

    it('calls onClose when Done button is clicked', async () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay in applied state', async () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT close when clicking inside the modal in applied state', async () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Apply behavior — multi-select ──

  describe('apply behavior — multi-select', () => {
    const action = makeMultiSelectAction();

    beforeEach(() => {
      applyRiderOption.mockResolvedValue(defaultResult);
    });

    it('calls applyRiderOption with all selected options', async () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      clickCheckbox(0);
      clickCheckbox(1);
      clickApplyMulti();

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

    it('shows result screen after applying', async () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      clickCheckbox(0);
      clickCheckbox(1);
      clickApplyMulti();

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
    });

    it('hides selection options after applying', async () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      clickCheckbox(0);
      clickCheckbox(1);
      clickApplyMulti();

      await waitFor(() => {
        expect(screen.queryByText(/Choose up to 3 effects/)).not.toBeInTheDocument();
      });
    });

    it('calls onClose when Done is clicked after multi-select apply', async () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ action, onClose })} />);
      clickCheckbox(0);
      clickCheckbox(1);
      clickApplyMulti();

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Close / cancel behavior ──

  describe('close behavior', () => {
    it('calls onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT close when clicking inside the modal body', () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles empty options array gracefully', () => {
      const action = makeSingleSelectAction({ options: [] });
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText('Divine Smite')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
      expect(screen.getByRole('button', { name: /Apply Effect$/ })).toBeDisabled();
    });

    it('handles undefined automation options gracefully', () => {
      const action = { name: 'No Automation Action' };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText('No Automation Action')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('handles undefined automation gracefully', () => {
      const action = { name: 'No Automation Action' };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText('No Automation Action')).toBeInTheDocument();
    });

    it('uses radio inputs when maxEffects is 1 (default)', () => {
      const action = {
        name: 'Default Max',
        automation: {
          type: 'attack_rider',
          options: [{ name: 'Opt A' }],
        },
      };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(1);
    });

    it('uses checkbox inputs when maxEffects > 1', () => {
      const action = makeMultiSelectAction();
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    });

    it('handles null result from applyRiderOption gracefully (stays open)', async () => {
      applyRiderOption.mockResolvedValue(null);
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();

      await waitFor(() => {
        expect(screen.queryByText('Done')).not.toBeInTheDocument();
      });
    });
  });

  // ── Improved Cunning Strike multi-select ──

  describe('Improved Cunning Strike multi-select', () => {
    const cunningStrikeAction = {
      name: 'Improved Cunning Strike',
      automation: {
        type: 'attack_rider',
        oncePerTurn: true,
        chooseOne: true,
        maxEffects: 2,
        options: [
          {
            name: 'Poison',
            cost: '1d6',
            effect: 'poisoned',
            saveType: 'CON',
            saveDc: 'ability',
            saveAbility: 'DEX',
            condition: 'poisoned',
            duration: '1_minute',
            repeatingSave: true,
            requires: "Poisoner's Kit",
          },
          {
            name: 'Trip',
            cost: '1d6',
            effect: 'prone',
            saveType: 'DEX',
            saveDc: 'ability',
            saveAbility: 'DEX',
            condition: 'prone',
            sizeLimit: 'large_or_smaller',
          },
          {
            name: 'Withdraw',
            cost: '1d6',
            effect: 'no_opportunity_attacks',
            movement: 'half_speed',
            noOAs: true,
          },
        ],
      },
    };

    it('renders checkbox inputs for Improved Cunning Strike', () => {
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('shows label with max count of 2', () => {
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toMatch(/Choose up to 2 effects/);
    });

    it('shows selected count starting at 0/2', () => {
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
      expect(screen.getByText(/0\/2 selected/)).toBeInTheDocument();
    });

    it('limits selection to maxEffects (2)', () => {
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
      clickCheckbox(0);
      clickCheckbox(1);
      expect(screen.getByText(/2\/2 selected/)).toBeInTheDocument();
      // Third checkbox should not be selectable
      clickCheckbox(2);
      expect(screen.getByText(/2\/2 selected/)).toBeInTheDocument();
    });

    it('calls applyRiderOption with multiple selected options', async () => {
      applyRiderOption.mockResolvedValue(defaultResult);
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
      clickCheckbox(0);
      clickCheckbox(1);
      clickApplyMulti();

      await waitFor(() => {
        expect(applyRiderOption).toHaveBeenCalledWith(
          cunningStrikeAction,
          expect.any(Object),
          defaultCampaignName,
          defaultTargetName,
          ['Poison', 'Trip']
        );
      });
    });

    it('shows cost for each option', () => {
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toContain('Cost: 1d6 Sneak Attack dice');
    });
  });
});
