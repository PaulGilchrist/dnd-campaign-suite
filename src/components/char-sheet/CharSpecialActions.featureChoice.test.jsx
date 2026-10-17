// @maintained-by-ai
// CharSpecialActions feature-choice lane — REAL FeatureChoiceModal on the sheet:
// - FEATURE_CHOICE_PROMPTS lane (defensive_tactics / hunter_prey): prompt lists hardcoded
//   options, suppressed once a _<Name>_choice runtime value exists; confirm delegates to
//   the ranger handler (applyChoice / applyHunterPreyChoice), never writes runtime directly.
// - damage_bonus string-options lane (CLA-116 Elemental Fury regression): always re-prompts
//   (options are changeable by clicking again), stores under _<Name>_option, logs the
//   choice, and shows the generic change hint (never the Short-Rest hint).
// - Negative filters: cannotAct blocks the prompt; non-string/absent options never prompt.
// executeHandler modal dispatch is owned by modals.test.jsx, delegated clicks by
// automationClickHandlers.test.jsx, wizard confirm internals by handlers/modalOnClose lanes.
// Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { applyChoice } from '../../services/automation/handlers/class-ranger/defensiveTacticsHandler.js';
import { applyChoice as applyHunterPreyChoice } from '../../services/automation/handlers/class-ranger/hunterPreyHandler.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

let capturedPopup = null;

const basePlayerStats = {
  name: 'TestCharacter',
  specialActions: [],
  class: {
    fightingStyles: [],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 2,
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function renderAndClick(playerStats, actionName, props = {}) {
  render(<CharSpecialActions playerStats={playerStats} campaignName="test" {...props} />);
  fireEvent.click(screen.getAllByText(new RegExp(actionName))[0]);
}

// FEATURE_CHOICE_PROMPTS lane: one row per automation type, options straight from the table.
const rangerChoiceCases = [
  { type: 'defensive_tactics', actionName: 'Defensive Tactics', storeKey: '_Defensive_Tactics_choice', options: ['Escape the Horde', 'Multiattack Defense'], handler: applyChoice, chosen: 'Escape the Horde' },
  { type: 'hunter_prey', actionName: 'Hunter Prey', storeKey: '_Hunter_Prey_choice', options: ['Colossus Slayer', 'Horde Breaker'], handler: applyHunterPreyChoice, chosen: 'Colossus Slayer' },
];

describe('CharSpecialActions - Feature Choice Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Capture popup writes (shared modalMocks default is an inert vi.fn setter).
    vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: (html) => { capturedPopup = html; } });
  });

  it.each(rangerChoiceCases)(
    '$type: click prompts the choice, confirm delegates to the ranger handler and shows its popup',
    async ({ type, actionName, options, handler, chosen }) => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: actionName, description: `Choose with ${type}.`, automation: { type } }],
      });
      renderAndClick(playerStats, actionName);

      await waitFor(() => {
        expect(screen.getByText(/Choose your option/)).toBeInTheDocument();
      });
      options.forEach(opt => {
        expect(screen.getByRole('button', { name: opt })).toBeInTheDocument();
      });

      handler.mockResolvedValue({ type: 'popup', payload: `<b>${actionName}</b><br/>${chosen} chosen.` });
      fireEvent.click(screen.getByRole('button', { name: chosen }));

      await waitFor(() => {
        expect(handler).toHaveBeenCalledWith(playerStats, 'test', chosen);
        expect(capturedPopup).toBe(`<b>${actionName}</b><br/>${chosen} chosen.`);
      });
      expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
      // Routing seam: the handler owns the choice, the component writes no runtime state.
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    }
  );

  it.each(rangerChoiceCases)(
    '$type: no prompt once a choice is stored under $storeKey',
    async ({ type, actionName, storeKey }) => {
      mockRuntimeStore[storeKey] = 'Already Chosen';

      const playerStats = createPlayerStats({
        specialActions: [{ name: actionName, description: `Choose with ${type}.`, automation: { type } }],
      });
      renderAndClick(playerStats, actionName);

      await waitFor(() => {
        expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
      });
      expect(applyChoice).not.toHaveBeenCalled();
      expect(applyHunterPreyChoice).not.toHaveBeenCalled();
      expect(capturedPopup).toBeNull();
    }
  );

  it('cannotAct blocks the feature-choice prompt entirely', async () => {
    const playerStats = createPlayerStats({
      specialActions: [{ name: 'Defensive Tactics', description: 'Choose a defensive option.', automation: { type: 'defensive_tactics' } }],
    });
    renderAndClick(playerStats, 'Defensive Tactics', { cannotAct: true });

    await waitFor(() => {
      expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
    });
    expect(applyChoice).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(capturedPopup).toBeNull();
  });

  it('CLA-116 damage_bonus regression: Elemental Fury prompts its string options, stores, logs, and lets the choice be changed', async () => {
    const elementalFury = {
      name: 'Elemental Fury',
      description: 'The might of the elements flows through you.',
      automation: {
        type: 'damage_bonus',
        trigger: 'weapon_or_beast_form_attack_hit',
        damageExpression: '1d8',
        damageType: 'Cold Fire Lightning or Thunder',
        oncePerTurn: true,
        options: ['Potent Spellcasting', 'Primal Strike'],
        casting_time: 'passive',
      },
    };

    renderAndClick(createPlayerStats({ specialActions: [elementalFury] }), 'Elemental Fury');

    await waitFor(() => {
      expect(screen.getByText(/Choose your option/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Potent Spellcasting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Primal Strike' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Primal Strike' }));

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', '_Elemental_Fury_option', 'Primal Strike', 'test');
    });
    expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestCharacter',
      abilityName: 'Elemental Fury',
      description: 'Chose option: Primal Strike',
    }));
    expect(capturedPopup).toContain('Option chosen: <b>Primal Strike</b>');
    expect(capturedPopup).toContain('This choice can be changed by clicking the feature again.');
    expect(capturedPopup).not.toContain('Short Rest');
    expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
    // damage_bonus options are component-local — ranger handlers stay out of it.
    expect(applyChoice).not.toHaveBeenCalled();
    expect(applyHunterPreyChoice).not.toHaveBeenCalled();

    // The popup's promise: clicking the feature again re-prompts and stores the new choice.
    fireEvent.click(screen.getAllByText(/Elemental Fury/)[0]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Potent Spellcasting' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Potent Spellcasting' }));

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenLastCalledWith('TestCharacter', '_Elemental_Fury_option', 'Potent Spellcasting', 'test');
    });
  });

  it.each([
    { label: 'no options at all', automation: { type: 'damage_bonus', damageExpression: '1d8' } },
    { label: 'object options', automation: { type: 'damage_bonus', damageExpression: '1d8', options: [{ name: 'Cold' }, { name: 'Fire' }] } },
  ])(
    'damage_bonus with $label never opens the feature-choice prompt',
    async ({ automation }) => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Damage Boost', description: 'Conditional damage boost.', automation }],
      });
      renderAndClick(playerStats, 'Damage Boost');

      await waitFor(() => {
        expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Cold')).not.toBeInTheDocument();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(capturedPopup).toBeNull();
    }
  );
});
