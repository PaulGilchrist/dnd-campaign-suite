// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackRiderModal from './AttackRiderModal.jsx';

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

import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';
import {
  makeProps, makeSingleSelectAction, makeMultiSelectAction,
  cunningStrikeAction, selectSingleOption, clickApplySingle,
  clickApplyMulti, clickCheckbox, defaultResult,
} from './AttackRiderModal.test-utils.js';

describe('AttackRiderModal', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('initial render', () => {
    it('renders the modal with header, body, actions, and action name', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByText('Divine Smite')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
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

    it('renders all options with their effect descriptions', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByText('Burning Hands')).toBeInTheDocument();
      expect(screen.getByText('Push Back')).toBeInTheDocument();
      expect(screen.getByText(/— \+5 to next attack/)).toBeInTheDocument();
      expect(screen.getByText(/— Push 15 ft/)).toBeInTheDocument();
    });

    it('renders option name without effect description when no effects match', () => {
      const action = { name: 'Plain Action', automation: { type: 'attack_rider', options: [{ name: 'Plain Effect' }], maxEffects: 1 } };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByText('Plain Effect')).toBeInTheDocument();
    });
  });

  describe('effect descriptions', () => {
    const effectTests = [
      { action: makeMultiSelectAction, name: 'Disadvantage Curse', desc: /— Disadvantage on next save/ },
      { action: makeMultiSelectAction, name: 'No Opportunity', desc: /— Cannot make Opportunity Attacks/ },
      { action: makeMultiSelectAction, name: 'Speed Drain', desc: /— Speed reduced by 15 ft/ },
      { action: () => ({ name: 'Custom Smite', automation: { type: 'attack_rider', options: [{ name: 'Power Strike', effect: 'next_attack_advantage', value: 10 }], maxEffects: 1 } }), name: 'Power Strike', desc: /— \+10 to next attack/ },
      { action: () => ({ name: 'Default Value Smite', automation: { type: 'attack_rider', options: [{ name: 'Basic Strike', effect: 'next_attack_advantage' }], maxEffects: 1 } }), name: 'Basic Strike', desc: /— \+5 to next attack/ },
      { action: () => ({ name: 'Sudden Strike', automation: { type: 'attack_rider', options: [{ name: 'Sudden Strike', effect: 'sudden_strike' }], maxEffects: 1 } }), name: 'Sudden Strike', desc: /— Make another attack vs\. different creature within 5 ft/ },
      { action: () => ({ name: 'Mass Fear', automation: { type: 'attack_rider', options: [{ name: 'Mass Fear', effect: 'mass_fear' }], maxEffects: 1 } }), name: 'Mass Fear', desc: /— Target \+ creatures within 10 ft make WIS save or be Frightened/ },
      { action: () => makeSingleSelectAction({ options: [{ name: 'Trip', effect: 'prone' }] }), name: 'Trip', desc: /— Target makes DEX save or gains Prone condition/ },
      { action: () => ({ name: 'Cunning Strike Poison', automation: { type: 'attack_rider', options: [{ name: 'Poison', effect: 'poisoned' }], maxEffects: 1 } }), name: 'Poison', desc: /— Target makes CON save or becomes Poisoned \(1 min, repeating\)/ },
      { action: () => ({ name: 'Charger', automation: { type: 'attack_rider', options: [{ name: 'Charger Move', effect: 'no_opportunity_attacks', movement: 30 }], maxEffects: 1 } }), name: 'Charger Move', desc: /— Move up to 30 without provoking OAs/ },
      { action: () => ({ name: 'Daze Attack', automation: { type: 'attack_rider', options: [{ name: 'Daze', effect: 'daze' }], maxEffects: 1 } }), name: 'Daze', desc: /— Target makes CON save or on next turn can only do one of: move, action, or Bonus Action/ },
      { action: () => ({ name: 'Unconscious Strike', automation: { type: 'attack_rider', options: [{ name: 'Unconscious', effect: 'unconscious' }], maxEffects: 1 } }), name: 'Unconscious', desc: /— Target makes CON save or becomes Unconscious \(1 min, repeating\)/ },
      { action: () => ({ name: 'Blinding Strike', automation: { type: 'attack_rider', options: [{ name: 'Blinded', effect: 'blinded' }], maxEffects: 1 } }), name: 'Blinded', desc: /— Target makes DEX save or becomes Blinded \(until end of its next turn\)/ },
      { action: () => ({ name: 'Elemental Attack', automation: { type: 'attack_rider', options: [{ name: 'Fire Damage', effect: 'damage_bonus' }], maxEffects: 1 } }), name: 'Fire Damage', desc: /— 1d6 damage/ },
      { action: () => ({ name: 'Elemental Attack', automation: { type: 'attack_rider', options: [{ name: 'Fire Damage', effect: 'damage_bonus', damageExpression: '2d6' }], maxEffects: 1 } }), name: 'Fire Damage', desc: /— 2d6 damage/ },
      { action: () => ({ name: 'Push Attack', automation: { type: 'attack_rider', options: [{ name: 'Push', effect: 'push', value: 15 }], maxEffects: 1 } }), name: 'Push', desc: /— Push 15 ft/ },
      { action: () => ({ name: 'Push Attack', automation: { type: 'attack_rider', options: [{ name: 'Push', effect: 'push' }], maxEffects: 1 } }), name: 'Push', desc: /— Push 10 ft/ },
    ];

    for (const { action, name, desc } of effectTests) {
      it(`renders effect description for ${name}`, () => {
        render(<AttackRiderModal {...makeProps({ action: action() })} />);
        expect(screen.getByText(desc)).toBeInTheDocument();
      });
    }

    it('renders cost description for Cunning Strike', () => {
      const action = { name: 'Cunning Strike', automation: { type: 'attack_rider', options: [{ name: 'Poison', effect: 'poisoned', cost: '2d6' }], maxEffects: 1 } };
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(document.querySelector('.sp-body').textContent).toContain('Cost: 2d6 Sneak Attack dice');
    });
  });

  describe('single select mode', () => {
    it('renders radio inputs and no checkboxes', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(2);
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    });

    it('selects an option and deselects previous when a different option is clicked', () => {
      render(<AttackRiderModal {...makeProps()} />);
      const firstOption = selectSingleOption('Burning Hands');
      const secondOption = screen.getByText('Push Back').parentElement;
      fireEvent.click(secondOption);
      expect(firstOption.querySelector('input[type="radio"]').checked).toBe(false);
      expect(secondOption.querySelector('input[type="radio"]').checked).toBe(true);
    });

    it('disables the apply button when no option is selected and enables it after selection', () => {
      render(<AttackRiderModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Apply Effect$/ })).toBeDisabled();
      selectSingleOption('Burning Hands');
      expect(screen.getByRole('button', { name: /Apply Effect$/ })).not.toBeDisabled();
    });
  });

  describe('multi-select mode', () => {
    const action = makeMultiSelectAction();

    it('renders checkboxes, multi-select label with max count and target name, and selected count', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
      const bodyDiv = document.querySelector('.sp-body');
      expect(bodyDiv.textContent).toMatch(/Choose up to 3 effects/);
      expect(bodyDiv.innerHTML).toMatch(/Goblin A/);
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });

    it('renders multi-select label without target name when null', () => {
      render(<AttackRiderModal {...makeProps({ action, targetName: null })} />);
      expect(document.querySelector('.sp-body').innerHTML).not.toMatch(/against/);
    });

    it('increments and decrements selected count when checkboxes are clicked', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      clickCheckbox(0);
      expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
      clickCheckbox(0); clickCheckbox(0); clickCheckbox(0);
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });

    it('enables apply button when at least one option is selected and prevents selecting more than maxEffects', () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      expect(screen.getByRole('button', { name: /Apply Effects$/ })).toBeDisabled();
      clickCheckbox(0);
      expect(screen.getByRole('button', { name: /Apply Effects$/ })).not.toBeDisabled();
      clickCheckbox(1); clickCheckbox(2);
      expect(screen.getByText(/3\/3 selected/)).toBeInTheDocument();
      expect(screen.queryByText(/4\/3 selected/)).not.toBeInTheDocument();
    });
  });

  describe('apply behavior — single select', () => {
    beforeEach(() => applyRiderOption.mockResolvedValue(defaultResult));

    it('calls applyRiderOption with correct arguments when applied', async () => {
      const props = makeProps();
      render(<AttackRiderModal {...props} />);
      selectSingleOption('Burning Hands'); clickApplySingle();
      await waitFor(() => {
        expect(applyRiderOption).toHaveBeenCalledWith(props.action, props.playerStats, props.campaignName, props.targetName, ['Burning Hands']);
      });
    });

    it('shows result screen with action name, description, and Done button, then closes on Done click', async () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands'); clickApplySingle();
      await waitFor(() => expect(screen.getByText('Effect applied successfully.')).toBeInTheDocument());
      expect(screen.getByText('Divine Smite')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Apply Effect$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders result description as HTML in the body', async () => {
      applyRiderOption.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Action', description: '<strong>Bold</strong> result.' } });
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands'); clickApplySingle();
      await waitFor(() => expect(document.querySelector('.sp-body').innerHTML).toContain('<strong>Bold</strong>'));
    });
  });

  describe('apply behavior — multi-select', () => {
    const action = makeMultiSelectAction();
    beforeEach(() => applyRiderOption.mockResolvedValue(defaultResult));

    it('calls applyRiderOption with all selected options', async () => {
      render(<AttackRiderModal {...makeProps({ action })} />);
      clickCheckbox(0); clickCheckbox(1); clickApplyMulti();
      await waitFor(() => {
        expect(applyRiderOption).toHaveBeenCalledWith(action, expect.any(Object), 'test-campaign', 'Goblin A', ['Disadvantage Curse', 'No Opportunity']);
      });
    });

    it('calls onClose when Done is clicked after multi-select apply', async () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ action, onClose })} />);
      clickCheckbox(0); clickCheckbox(1); clickApplyMulti();
      await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('close behavior', () => {
    it('calls onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked', () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty options and undefined automation gracefully', () => {
      const actionEmpty = makeSingleSelectAction({ options: [] });
      render(<AttackRiderModal {...makeProps({ action: actionEmpty })} />);
      expect(screen.getByText('Divine Smite')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
      expect(screen.getByRole('button', { name: /Apply Effect$/ })).toBeDisabled();

      const actionNoAutomation = { name: 'No Automation Action' };
      render(<AttackRiderModal {...makeProps({ action: actionNoAutomation })} />);
      expect(screen.getByText('No Automation Action')).toBeInTheDocument();
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    });

    it('stays open when applyRiderOption returns null', async () => {
      applyRiderOption.mockResolvedValue(null);
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands'); clickApplySingle();
      await waitFor(() => expect(screen.queryByText('Done')).not.toBeInTheDocument());
    });
  });

  describe('Improved Cunning Strike multi-select', () => {
    it('renders checkboxes with costs, shows 0/2 selected, limits to maxEffects, and calls applyRiderOption with selected options', async () => {
      applyRiderOption.mockResolvedValue(defaultResult);
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
      expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
      expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
      expect(document.querySelector('.sp-body').textContent).toContain('Cost: 1d6 Sneak Attack dice');
      expect(screen.getByText(/0\/2 selected/)).toBeInTheDocument();
      clickCheckbox(0); clickCheckbox(1);
      expect(screen.getByText(/2\/2 selected/)).toBeInTheDocument();
      clickCheckbox(2);
      expect(screen.getByText(/2\/2 selected/)).toBeInTheDocument();
      clickApplyMulti();
      await waitFor(() => {
        expect(applyRiderOption).toHaveBeenCalledWith(cunningStrikeAction, expect.any(Object), 'test-campaign', 'Goblin A', ['Poison', 'Trip']);
      });
    });
  });

  describe("Stalker's Flurry secondary targets", () => {
    beforeEach(() => applyRiderOption.mockResolvedValue(defaultResult));

    it("shows Stalker's Flurry secondary target modal after applying and handles Sudden Strike path", async () => {
      const { getRuntimeValue: grv } = await import('../../../../hooks/runtime/useRuntimeState.js');
      grv.mockImplementation((char, key) => {
        if (key === 'stalkersFlurrySecondaryTargets') return [{ label: 'Creature A', value: 'Creature A' }];
        if (key === 'stalkersFlurryOptions') return ['Sudden Strike'];
        return undefined;
      });
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands'); clickApplySingle();
      await waitFor(() => expect(screen.getByText("Stalker's Flurry")).toBeInTheDocument());
      fireEvent.click(document.querySelector('input[type="radio"][name="secondaryTarget"]'));
      fireEvent.click(screen.getByRole('button', { name: 'Attack Target' }));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("handles Mass Fear path when selected", async () => {
      const { getRuntimeValue: grv } = await import('../../../../hooks/runtime/useRuntimeState.js');
      grv.mockImplementation((char, key) => {
        if (key === 'stalkersFlurrySecondaryTargets') return [{ label: 'Creature A', value: 'Creature A' }];
        if (key === 'stalkersFlurryOptions') return ['Mass Fear'];
        if (key === 'targetEffects' && char === 'campaign') return [{ effect: 'mass_fear', duration: '1_round' }];
        return undefined;
      });
      render(<AttackRiderModal {...makeProps()} />);
      selectSingleOption('Burning Hands'); clickApplySingle();
      await waitFor(() => expect(screen.getByText("Stalker's Flurry")).toBeInTheDocument());
      fireEvent.click(document.querySelector('input[type="radio"][name="secondaryTarget"]'));
      fireEvent.click(screen.getByRole('button', { name: 'Apply Fear' }));
      await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
    });
  });
});
