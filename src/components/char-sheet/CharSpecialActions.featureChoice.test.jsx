// @maintained-by-ai 2026-11-27
// CharSpecialActions feature-choice lane — REAL FeatureChoiceModal on the sheet:
// - FEATURE_CHOICE_PROMPTS lane (defensive_tactics / hunter_prey): prompt lists hardcoded
//   options, suppressed once a _<Name>_choice runtime value exists (the click then routes
//   to the normal grid lane); confirm delegates to the ranger handler (applyChoice /
//   applyHunterPreyChoice), never writes runtime directly. Fixtures use the REAL feature
//   names from public/data/classes.json so the sheet's derived optionKey matches the key
//   the handlers write ("Hunter's Prey" → _Hunter's_Prey_choice, hunterPreyHandler.js:42).
// - damage_bonus string-options lane (CLA-116 Elemental Fury regression): always re-prompts
//   (options are changeable by clicking again), stores under _<Name>_option, logs the
//   choice, and shows the generic change hint — exact popup copy pins the retired
//   Short-Rest ternary as dead (component dead-arm census #101).
// - Cancel (handleFeatureChoiceSkip) closes the prompt with zero spend and fully clears
//   state so the next click re-prompts.
// - Negative filters: cannotAct blocks the prompt (RB-1115 reason popup); non-string or
//   absent options never make the row clickable.
// Not this lane: executeHandler modal dispatch (modals.test.jsx), delegated clicks
// (automationClickHandlers.test.jsx), wizard confirm internals (handlers/modalOnClose
// lanes), animal_aspect open/confirm/cancel (handlers.test.jsx), inline-modal hosts
// (modalsInline.test.jsx — its header explicitly delegates feature-choice here).
// Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { applyChoice } from '../../services/automation/handlers/class-ranger/defensiveTacticsHandler.js';
import { applyChoice as applyHunterPreyChoice } from '../../services/automation/handlers/class-ranger/hunterPreyHandler.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { CANNOT_ACT_REASON } from '../../services/combat/canTakeAction.js';

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
  // Rows render "Name:" — exact match targets the row, never the modal header.
  fireEvent.click(screen.getByText(`${actionName}:`));
}

// FEATURE_CHOICE_PROMPTS lane: one row per automation type, options straight from the table.
const rangerChoiceCases = [
  { type: 'defensive_tactics', actionName: 'Defensive Tactics', storeKey: '_Defensive_Tactics_choice', handler: applyChoice, options: ['Escape the Horde', 'Multiattack Defense'], chosen: 'Escape the Horde', restCopy: 'Short Rest or Long Rest' },
  { type: 'hunter_prey', actionName: "Hunter's Prey", storeKey: "_Hunter's_Prey_choice", handler: applyHunterPreyChoice, options: ['Colossus Slayer', 'Horde Breaker'], chosen: 'Colossus Slayer', restCopy: 'Short or Long Rest' },
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
    '$type: click prompts the choice, confirm delegates to the ranger handler once and forwards its popup payload verbatim',
    async ({ type, actionName, options, handler, chosen, restCopy }) => {
      const specialAction = { name: actionName, description: `Choose with ${type}.`, automation: { type } };
      const playerStats = createPlayerStats({ specialActions: [specialAction] });
      renderAndClick(playerStats, actionName);

      // Exact modal copy: prompt title, the clicked feature's name (header), and the
      // hardcoded option table.
      await waitFor(() => {
        expect(screen.getByText('Choose your option:')).toBeInTheDocument();
      });
      expect(screen.getByText(actionName)).toBeInTheDocument();
      options.forEach(opt => {
        expect(screen.getByRole('button', { name: opt })).toBeInTheDocument();
      });

      // Real handler return shape (defensiveTacticsHandler.js:46-54,
      // hunterPreyHandler.js:52-60): an automation_info payload object.
      const result = {
        type: 'popup',
        payload: { type: 'automation_info', name: actionName, description: `Selected: <b>${chosen}</b>. This choice can be changed on a ${restCopy}.` },
      };
      handler.mockResolvedValue(result);
      fireEvent.click(screen.getByRole('button', { name: chosen }));

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(playerStats, 'test', chosen);
        // Routing seam: the component forwards result.payload verbatim into the
        // setPopupHtml HTML-string channel. SOURCE BUG (reported, not laundered):
        // CharSpecialActions.jsx:412/:420 pass the raw automation_info OBJECT here,
        // unlike the showPayloadPopup formatter (:112) every other lane uses.
        expect(capturedPopup).toBe(result.payload);
      });
      expect(screen.queryByText('Choose your option:')).not.toBeInTheDocument();
      // Zero-silence contract: the handler owns the choice; the component's click is
      // consumed by the prompt — no runtime write, no log, no grid dispatch.
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(executeHandler).not.toHaveBeenCalled();
    }
  );

  it.each(rangerChoiceCases)(
    '$type: stored $storeKey choice suppresses the prompt and routes the click to the normal grid lane',
    async ({ type, actionName, storeKey }) => {
      mockRuntimeStore[storeKey] = 'Already Chosen';

      const specialAction = { name: actionName, description: `Choose with ${type}.`, automation: { type } };
      const playerStats = createPlayerStats({ specialActions: [specialAction] });
      renderAndClick(playerStats, actionName);

      // Suppression is not dead-clicking: the feature runs through executeHandler with
      // the same row object and props the sheet component holds.
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler).toHaveBeenCalledWith(specialAction, playerStats, 'test', undefined, undefined);
      });
      expect(screen.queryByText('Choose your option:')).not.toBeInTheDocument();
      expect(applyChoice).not.toHaveBeenCalled();
      expect(applyHunterPreyChoice).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(capturedPopup).toBeNull();
    }
  );

  it('Cancel closes the feature-choice prompt with zero spend and the next click re-prompts', async () => {
    const playerStats = createPlayerStats({
      specialActions: [{ name: 'Defensive Tactics', description: 'Choose a defensive option.', automation: { type: 'defensive_tactics' } }],
    });
    renderAndClick(playerStats, 'Defensive Tactics');

    await waitFor(() => {
      expect(screen.getByText('Choose your option:')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Choose your option:')).not.toBeInTheDocument();
    });
    // Full zero-silence contract: cancelling spends nothing on any channel.
    expect(applyChoice).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(executeHandler).not.toHaveBeenCalled();
    expect(capturedPopup).toBeNull();

    // State fully cleared — the indefinite prompt can be reopened at will.
    fireEvent.click(screen.getByText('Defensive Tactics:'));
    await waitFor(() => {
      expect(screen.getByText('Choose your option:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Escape the Horde' })).toBeInTheDocument();
    });
  });

  it('cannotAct blocks the feature-choice prompt but pops the shared reason (RB-1115)', async () => {
    const playerStats = createPlayerStats({
      specialActions: [{ name: 'Defensive Tactics', description: 'Choose a defensive option.', automation: { type: 'defensive_tactics' } }],
    });
    renderAndClick(playerStats, 'Defensive Tactics', { cannotAct: true });

    await waitFor(() => {
      expect(capturedPopup).toBe(CANNOT_ACT_REASON);
    });
    // Zero-silence gate: no prompt, no handler, no write, no log, no grid dispatch.
    expect(screen.queryByText('Choose your option:')).not.toBeInTheDocument();
    expect(applyChoice).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('CLA-116 damage_bonus regression: Elemental Fury prompts its string options, stores/logs exactly one write per choice, and lets the choice be changed', async () => {
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
      expect(screen.getByText('Choose your option:')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Potent Spellcasting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Primal Strike' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Primal Strike' }));

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    });
    // Ordered write/log census: one spend, one log, exact campaign-scoped args.
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([
      ['TestCharacter', '_Elemental_Fury_option', 'Primal Strike', 'test'],
    ]);
    expect(vi.mocked(addEntry).mock.calls).toEqual([
      ['test', { type: 'ability_use', characterName: 'TestCharacter', abilityName: 'Elemental Fury', description: 'Chose option: Primal Strike' }],
    ]);
    // Exact popup copy (CharSpecialActions.jsx:440) — proves the generic hint and kills
    // any resurrected Short-Rest ternary arm.
    expect(capturedPopup).toBe('<b>Elemental Fury</b><br/>Option chosen: <b>Primal Strike</b>. This choice can be changed by clicking the feature again.');
    expect(screen.queryByText('Choose your option:')).not.toBeInTheDocument();
    // damage_bonus options are component-local — ranger handlers and the grid stay out.
    expect(applyChoice).not.toHaveBeenCalled();
    expect(applyHunterPreyChoice).not.toHaveBeenCalled();
    expect(executeHandler).not.toHaveBeenCalled();

    // The popup's promise: clicking the feature again re-prompts and stores the new choice.
    fireEvent.click(screen.getByText('Elemental Fury:'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Potent Spellcasting' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Potent Spellcasting' }));

    await waitFor(() => {
      expect(capturedPopup).toBe('<b>Elemental Fury</b><br/>Option chosen: <b>Potent Spellcasting</b>. This choice can be changed by clicking the feature again.');
    });
    // Double-spend detector: exactly one write/log per choice, in order.
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([
      ['TestCharacter', '_Elemental_Fury_option', 'Primal Strike', 'test'],
      ['TestCharacter', '_Elemental_Fury_option', 'Potent Spellcasting', 'test'],
    ]);
    expect(vi.mocked(addEntry).mock.calls).toEqual([
      ['test', { type: 'ability_use', characterName: 'TestCharacter', abilityName: 'Elemental Fury', description: 'Chose option: Primal Strike' }],
      ['test', { type: 'ability_use', characterName: 'TestCharacter', abilityName: 'Elemental Fury', description: 'Chose option: Potent Spellcasting' }],
    ]);
  });

  it.each([
    { label: 'no options at all', automation: { type: 'damage_bonus', damageExpression: '1d8' } },
    { label: 'object options', automation: { type: 'damage_bonus', damageExpression: '1d8', options: [{ name: 'Cold' }, { name: 'Fire' }] } },
  ])(
    'damage_bonus with $label renders a non-clickable row with full zero-silence',
    async ({ automation }) => {
      const playerStats = createPlayerStats({
        specialActions: [{ name: 'Damage Boost', description: 'Conditional damage boost.', automation }],
      });
      renderAndClick(playerStats, 'Damage Boost');

      // Full zero-silence contract: the row has no click lane at all — no prompt,
      // no option names, no write, no popup, no grid dispatch.
      expect(screen.queryByText('Choose your option:')).not.toBeInTheDocument();
      expect(screen.queryByText('Cold')).not.toBeInTheDocument();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(executeHandler).not.toHaveBeenCalled();
      expect(capturedPopup).toBeNull();
    }
  );
});
