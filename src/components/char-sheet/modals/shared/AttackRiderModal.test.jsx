// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackRiderModal from './AttackRiderModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/attackRiderHandler.js', () => ({
  applyRiderOption: vi.fn(),
  // automation/index.js imports handle statically — mock full surface
  handle: vi.fn(),
}));
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js', () => ({
  applyVersatileTrickster: vi.fn(),
}));

import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import {
  makeProps, makeSingleSelectAction, makeMultiSelectAction,
  cunningStrikeAction, selectSingleOption, clickApplySingle,
  clickApplyMulti, clickCheckbox, defaultResult,
} from './AttackRiderModal.test-utils.js';

// One action exercising every RIDER_EFFECT_LABELS rule (custom values and
// ?? defaults) plus one plain option that must render without a description.
const allEffectsAction = {
  name: 'Kitchen Sink Smite',
  automation: {
    type: 'attack_rider',
    maxEffects: 1,
    options: [
      { name: 'Disadvantage Curse', effect: 'disadvantage_on_next_save' },
      { name: 'No Opportunity', noOpportunityAttacks: true },
      { name: 'Speed Drain', effect: 'speed_reduction' },
      { name: 'Power Strike', effect: 'next_attack_advantage', value: 10 },
      { name: 'Jab', effect: 'next_attack_advantage' },
      { name: 'Shove', effect: 'push', value: 15 },
      { name: 'Nudge', effect: 'push' },
      { name: 'Sudden Strike', effect: 'sudden_strike' },
      { name: 'Mass Fear', effect: 'mass_fear' },
      { name: 'Trip', effect: 'prone' },
      { name: 'Poison', effect: 'poisoned', cost: '2d6' },
      { name: 'Charger Move', effect: 'no_opportunity_attacks', movement: 30 },
      { name: 'Daze', effect: 'daze' },
      { name: 'Unconscious', effect: 'unconscious' },
      { name: 'Blinded', effect: 'blinded' },
      { name: 'Fire Burst', effect: 'damage_bonus', damageExpression: '2d6' },
      { name: 'Ember', effect: 'damage_bonus' },
      { name: 'Plain Effect' },
    ],
  },
};

describe('AttackRiderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyRiderOption.mockResolvedValue(defaultResult);
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('renders single-select mode: header, instruction with target, radio options with descriptions, Cancel', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Choose an effect against Goblin A:');
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(screen.getByText(/— \+5 to next attack/)).toBeInTheDocument();
    expect(screen.getByText(/— Push 15 ft/)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('omits "against <target>" from the instruction when targetName is null', () => {
    render(<AttackRiderModal {...makeProps({ targetName: null })} />);
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Choose an effect:');
    expect(body.innerHTML).not.toMatch(/against/);
  });

  it('describes every rider effect kind (custom values and defaults) and omits descriptions for plain options', () => {
    render(<AttackRiderModal {...makeProps({ action: allEffectsAction })} />);
    const body = document.querySelector('.sp-body').textContent;
    expect(body).toContain('Disadvantage on next save');
    expect(body).toContain('Cannot make Opportunity Attacks');
    expect(body).toContain('Speed reduced by 15 ft');
    expect(body).toContain('+10 to next attack');
    expect(body).toContain('+5 to next attack');
    expect(body).toContain('Push 15 ft');
    expect(body).toContain('Push 10 ft');
    expect(body).toContain('Make another attack vs. different creature within 5 ft');
    expect(body).toContain('Target + creatures within 10 ft make WIS save or be Frightened');
    expect(body).toContain('Target makes DEX save or gains Prone condition');
    expect(body).toContain('Target makes CON save or becomes Poisoned (1 min, repeating)');
    expect(body).toContain('Move up to 30 without provoking OAs');
    expect(body).toContain('Target makes CON save or on next turn can only do one of: move, action, or Bonus Action');
    expect(body).toContain('Target makes CON save or becomes Unconscious (1 min, repeating)');
    expect(body).toContain('Target makes DEX save or becomes Blinded (until end of its next turn)');
    expect(body).toContain('2d6 damage');
    expect(body).toContain('1d6 damage');
    expect(body).toContain('Cost: 2d6 Sneak Attack dice');
    // Plain option with no matching rules renders its name only.
    expect(screen.getByText('Plain Effect').closest('label').textContent).toBe('Plain Effect');
  });

  it('renders multi-select mode: checkboxes, max-effects instruction with target, and live selected count gating Apply', () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('Choose up to 3 effects against Goblin A:');
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Effects$/ })).toBeDisabled();
    clickCheckbox(0);
    expect(screen.getByText(/1\/3 selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Effects$/ })).not.toBeDisabled();
    clickCheckbox(0);
    expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Effects$/ })).toBeDisabled();
  });

  it('single select: choosing an option enables Apply and moves the selection to the new option', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Apply Effect$/ })).toBeDisabled();
    const firstOption = selectSingleOption('Burning Hands');
    expect(screen.getByRole('button', { name: /Apply Effect$/ })).not.toBeDisabled();
    fireEvent.click(screen.getByText('Push Back').parentElement);
    expect(firstOption.querySelector('input[type="radio"]').checked).toBe(false);
    expect(screen.getByText('Push Back').parentElement.querySelector('input[type="radio"]').checked).toBe(true);
  });

  it('applies a single selection, shows the HTML result overlay, and closes on Done', async () => {
    const props = makeProps();
    applyRiderOption.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Action', description: '<strong>Bold</strong> result.' },
    });
    render(<AttackRiderModal {...props} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();
    await waitFor(() => expect(document.querySelector('.sp-body').innerHTML).toContain('<strong>Bold</strong>'));
    expect(applyRiderOption).toHaveBeenCalledWith(
      props.action, props.playerStats, props.campaignName, props.targetName, ['Burning Hands']);
    expect(screen.queryByRole('button', { name: /Apply Effect$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('multi-select: calls applyRiderOption with every selected option name', async () => {
    const action = makeMultiSelectAction();
    render(<AttackRiderModal {...makeProps({ action })} />);
    clickCheckbox(0);
    clickCheckbox(1);
    clickApplyMulti();
    await waitFor(() => {
      expect(applyRiderOption).toHaveBeenCalledWith(action, expect.any(Object), 'test-campaign', 'Goblin A', ['Disadvantage Curse', 'No Opportunity']);
    });
  });

  it('enforces the maxEffects cap while selecting and applies only the chosen options', async () => {
    render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
    expect(screen.getByText(/0\/2 selected/)).toBeInTheDocument();
    clickCheckbox(0);
    clickCheckbox(1);
    expect(screen.getByText(/2\/2 selected/)).toBeInTheDocument();
    clickCheckbox(2);
    expect(screen.getByText(/2\/2 selected/)).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[2]).not.toBeChecked();
    clickApplyMulti();
    await waitFor(() => {
      expect(applyRiderOption).toHaveBeenCalledWith(cunningStrikeAction, expect.any(Object), 'test-campaign', 'Goblin A', ['Poison', 'Trip']);
    });
  });

  it('Cancel closes the modal, but clicking the overlay does not', () => {
    const onClose = vi.fn();
    render(<AttackRiderModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders safely with empty options and with an action that has no automation', () => {
    render(<AttackRiderModal {...makeProps({ action: makeSingleSelectAction({ options: [] }) })} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Apply Effect$/ })).toBeDisabled();

    render(<AttackRiderModal {...makeProps({ action: { name: 'No Automation Action' } })} />);
    expect(screen.getByText('No Automation Action')).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(0);
  });

  describe("Stalker's Flurry secondary targets", () => {
    const secondaryTargets = [{ label: 'Creature A', value: 'Creature A' }];

    function mockFlurry(options) {
      getRuntimeValue.mockImplementation((char, key) => {
        if (key === 'stalkersFlurrySecondaryTargets') return secondaryTargets;
        if (key === 'stalkersFlurryOptions') return options;
        if (key === 'targetEffects' && char === 'campaign') return [{ effect: 'mass_fear', duration: '1_round' }, { effect: 'prone' }];
        return undefined;
      });
    }

    function chooseCreatureAndConfirm(buttonName) {
      fireEvent.click(document.querySelector('input[type="radio"][name="secondaryTarget"]'));
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
    }

    it('Sudden Strike: persists the pending strike target and closes without a result screen', async () => {
      mockFlurry(['Sudden Strike']);
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();
      await waitFor(() => expect(screen.getByText("Stalker's Flurry")).toBeInTheDocument());
      chooseCreatureAndConfirm('Attack Target');
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'stalkersFlurryChosenTarget', 'Creature A', 'test-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'pendingSuddenStrikeTarget', 'Creature A', 'test-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'pendingSuddenStrike', true, 'test-campaign');
      expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.anything(), expect.anything());
    });

    it('Mass Fear: retargets the campaign mass_fear effect and shows the result overlay', async () => {
      mockFlurry(['Mass Fear']);
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      selectSingleOption('Burning Hands');
      clickApplySingle();
      await waitFor(() => expect(screen.getByText("Stalker's Flurry")).toBeInTheDocument());
      chooseCreatureAndConfirm('Apply Fear');
      await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
      expect(screen.getByText(/Mass Fear epicenter set to/)).toBeInTheDocument();
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
        expect.arrayContaining([expect.objectContaining({ effect: 'mass_fear', target: 'Creature A', duration: '1_round' })]),
        'test-campaign');
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
