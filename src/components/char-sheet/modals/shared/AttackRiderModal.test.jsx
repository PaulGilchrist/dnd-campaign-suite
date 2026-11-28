// @maintained-by-ai 2026-11-27
// Modal-surface lane: chooser rendering, selection gating, apply payloads,
// committed-cost latch and Stalker's Flurry follow-up. Rider handler internals
// live in services/automation/handlers/combat/attackRiderHandler*.test.js; the
// Charger row-copy face and option aria-label tier live in this folder's
// .charger-rows / .option-aria-labels siblings; the Versatile Trickster flow
// lives in .versatileTrickster.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
  cunningStrikeAction, clickApplySingle,
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

// Rows resolve via the explicit aria-label tier (`<Option> <target>`); the
// default makeProps target is 'Goblin A'.
function chooseRadio(name) {
  fireEvent.click(screen.getByRole('radio', { name }));
}

describe('AttackRiderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations — re-install every default here.
    applyRiderOption.mockResolvedValue(defaultResult);
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('renders single-select mode: header, instruction with target, radio options with descriptions, Cancel', () => {
    render(<AttackRiderModal {...makeProps()} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
    expect(screen.getByText(/Choose an effect against/))
      .toHaveTextContent('Choose an effect against Goblin A:');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('radio', { name: 'Burning Hands Goblin A' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Push Back Goblin A' })).toBeInTheDocument();
    expect(screen.getByText(/— \+5 to next attack/)).toBeInTheDocument();
    expect(screen.getByText(/— Push 15 ft/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('omits "against <target>" from the instruction when targetName is null', () => {
    render(<AttackRiderModal {...makeProps({ targetName: null })} />);
    const instruction = screen.getByText(/Choose an effect/);
    expect(instruction).toHaveTextContent('Choose an effect:');
    expect(instruction.textContent).not.toMatch(/against/i);
  });

  it('describes every rider effect kind (custom values and defaults) and omits descriptions for plain options', () => {
    const { container } = render(<AttackRiderModal {...makeProps({ action: allEffectsAction })} />);
    for (const phrase of [
      'Disadvantage on next save',
      'Cannot make Opportunity Attacks',
      'Speed reduced by 15 ft',
      '+10 to next attack',
      '+5 to next attack',
      'Push target 15 feet away from you',
      'Push target 10 feet away from you',
      'Make another attack vs. different creature within 5 ft',
      'Target + creatures within 10 ft make WIS save or be Frightened',
      'Target makes DEX save or gains Prone condition',
      'Target makes CON save or becomes Poisoned (1 min, repeating)',
      'Move up to 30 without provoking OAs',
      'Target makes CON save or on next turn can only do one of: move, action, or Bonus Action',
      'Target makes CON save or becomes Unconscious (1 min, repeating)',
      'Target makes DEX save or becomes Blinded (until end of its next turn)',
      '2d6 damage',
      '1d6 damage',
      'Cost: 2d6 Sneak Attack dice',
    ]) {
      expect(container).toHaveTextContent(phrase);
    }
    // Plain option with no matching rules renders its name only.
    expect(screen.getByText('Plain Effect').closest('label').textContent).toBe('Plain Effect');
  });

  it('renders multi-select mode: checkboxes, max-effects instruction with target, and live selected count gating Apply', () => {
    render(<AttackRiderModal {...makeProps({ action: makeMultiSelectAction() })} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText(/Choose up to 3 effects against/))
      .toHaveTextContent('Choose up to 3 effects against Goblin A:');
    const apply = screen.getByRole('button', { name: 'Apply Effects' });
    expect(screen.getByText('0/3 selected')).toBeInTheDocument();
    expect(apply).toBeDisabled();
    clickCheckbox(0);
    expect(screen.getByText('1/3 selected')).toBeInTheDocument();
    expect(apply).not.toBeDisabled();
    clickCheckbox(0);
    expect(screen.getByText('0/3 selected')).toBeInTheDocument();
    expect(apply).toBeDisabled();
  });

  it('single select: choosing an option enables Apply and moves the selection to the new option', () => {
    render(<AttackRiderModal {...makeProps()} />);
    const apply = screen.getByRole('button', { name: 'Apply Effect' });
    expect(apply).toBeDisabled();
    const first = screen.getByRole('radio', { name: 'Burning Hands Goblin A' });
    const second = screen.getByRole('radio', { name: 'Push Back Goblin A' });
    fireEvent.click(first);
    expect(apply).not.toBeDisabled();
    fireEvent.click(second);
    expect(first).not.toBeChecked();
    expect(second).toBeChecked();
  });

  it('applies a single selection, shows the HTML result overlay, and closes on Done', async () => {
    const props = makeProps();
    applyRiderOption.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Divine Smite', description: '<strong>Bold</strong> result.' },
    });
    render(<AttackRiderModal {...props} />);
    chooseRadio('Burning Hands Goblin A');
    clickApplySingle();
    await waitFor(() => expect(applyRiderOption).toHaveBeenCalledTimes(1));
    expect(applyRiderOption).toHaveBeenCalledWith(
      props.action, props.playerStats, props.campaignName, props.targetName, ['Burning Hands']);
    // The description renders as markup — an escaped-text face would show the
    // literal tag bytes instead of a <strong> element.
    await waitFor(() => expect(screen.getByText('Bold').tagName).toBe('STRONG'));
    expect(screen.getByText('result.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply Effect' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('multi-select: enforces the maxEffects cap while selecting and applies exactly the chosen options in click order', async () => {
    render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction })} />);
    expect(screen.getByText('0/2 selected')).toBeInTheDocument();
    clickCheckbox(0);
    clickCheckbox(1);
    expect(screen.getByText('2/2 selected')).toBeInTheDocument();
    clickCheckbox(2); // cap refuses the third pick
    expect(screen.getByText('2/2 selected')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[2]).not.toBeChecked();
    clickApplyMulti();
    await waitFor(() => expect(applyRiderOption).toHaveBeenCalledTimes(1));
    expect(applyRiderOption).toHaveBeenCalledWith(
      cunningStrikeAction, { name: 'TestCharacter' }, 'test-campaign', 'Goblin A', ['Poison', 'Trip']);
    // Unchosen options never ride the payload.
    expect(applyRiderOption.mock.calls[0][4]).not.toContain('Withdraw');
  });

  it('Cancel closes the modal, but clicking the backdrop does not', () => {
    const onClose = vi.fn();
    const { container } = render(<AttackRiderModal {...makeProps({ onClose })} />);
    fireEvent.click(container.firstChild);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('Post-apply committed-cost lock (DG backlog)', () => {
    // Deferred applyRiderOption: models the real window where the cost leg has
    // paid (ability_use row + sneak dice deducted) and a save prompt stacks
    // behind the still-open chooser — Cancel must be disabled for all of it.
    function deferred() {
      let resolve;
      const promise = new Promise(r => { resolve = r; });
      return { promise, resolve };
    }

    it('Cunning Strike chooser: Apply disables Cancel and shows the committed-cost copy mid-dispatch; a re-click never re-dispatches', async () => {
      const { promise, resolve } = deferred();
      applyRiderOption.mockReturnValue(promise);
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction, onClose })} />);
      clickCheckbox(1); // Trip — pays the 1d6 Cunning Strike cost inside applyRiderOption
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
      clickApplyMulti();
      await waitFor(() => expect(applyRiderOption).toHaveBeenCalledTimes(1));
      // Paid-cost escape hatch is closed: Cancel disabled, honest copy shown,
      // Apply disabled so a stray re-click can never pay a second cost row.
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Apply Effects' })).toBeDisabled();
      expect(screen.getByText(/Cunning Strike cost is already committed/)).toBeInTheDocument();
      clickApplyMulti(); // same-tick/double-press — the ref latch refuses a second dispatch
      expect(applyRiderOption).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      // Trip save legs resolve to null (CLA-376): after the legs finish the
      // chooser auto-closes ONCE (resume path in the host), no Cancel needed.
      await act(async () => { resolve(null); });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('single-select non-CS chooser shows the generic committed copy and the result overlay after resolve', async () => {
      const { promise, resolve } = deferred();
      applyRiderOption.mockReturnValue(promise);
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      chooseRadio('Burning Hands Goblin A');
      clickApplySingle();
      await waitFor(() => expect(applyRiderOption).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByText(/this choice is already committed/)).toBeInTheDocument();
      await act(async () => { resolve(defaultResult); });
      expect(screen.getByText('Effect applied successfully.')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('pre-apply Cancel on the multi-select chooser stays enabled and spends nothing (unpaid exit unchanged)', () => {
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ action: cunningStrikeAction, onClose })} />);
      clickCheckbox(1);
      const cancel = screen.getByRole('button', { name: 'Cancel' });
      expect(cancel).not.toBeDisabled();
      expect(screen.queryByText(/committed/)).not.toBeInTheDocument();
      fireEvent.click(cancel);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(applyRiderOption).not.toHaveBeenCalled();
    });
  });

  it('renders safely with empty options and with an action that has no automation', () => {
    const empty = render(<AttackRiderModal {...makeProps({ action: makeSingleSelectAction({ options: [] }) })} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Apply Effect' })).toBeDisabled();
    empty.unmount();

    render(<AttackRiderModal {...makeProps({ action: { name: 'No Automation Action' } })} />);
    expect(screen.getByText('No Automation Action')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    // Missing automation falls back to the single-select face.
    expect(screen.getByRole('button', { name: 'Apply Effect' })).toBeDisabled();
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
      fireEvent.click(screen.getByRole('radio', { name: 'Select Creature A' }));
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
    }

    it('Sudden Strike: persists the pending strike target and closes without a result screen', async () => {
      mockFlurry(['Sudden Strike']);
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      chooseRadio('Burning Hands Goblin A');
      clickApplySingle();
      await waitFor(() => expect(screen.getByText("Stalker's Flurry")).toBeInTheDocument());
      chooseCreatureAndConfirm('Attack Target');
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'stalkersFlurryChosenTarget', 'Creature A', 'test-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'pendingSuddenStrikeTarget', 'Creature A', 'test-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'pendingSuddenStrike', true, 'test-campaign');
      // The Sudden Strike branch must not touch the campaign effect list.
      expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', expect.anything(), expect.anything());
    });

    it('Mass Fear: retargets the campaign mass_fear effect and shows the result overlay', async () => {
      mockFlurry(['Mass Fear']);
      const onClose = vi.fn();
      render(<AttackRiderModal {...makeProps({ onClose })} />);
      chooseRadio('Burning Hands Goblin A');
      clickApplySingle();
      await waitFor(() => expect(screen.getByText("Stalker's Flurry")).toBeInTheDocument());
      chooseCreatureAndConfirm('Apply Fear');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument());
      expect(screen.getByText(/Mass Fear epicenter set to/)).toBeInTheDocument();
      // Full shipped shape: only the mass_fear row gains the retarget, the
      // untouched rows and fields ride along byte-for-byte.
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
        { effect: 'mass_fear', duration: '1_round', target: 'Creature A' },
        { effect: 'prone' },
      ], 'test-campaign');
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
