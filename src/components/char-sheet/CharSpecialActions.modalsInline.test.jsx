// @maintained-by-ai 2026-11-27
// CharSpecialActions inline-modal-host lane: the mount/dismiss/confirm seams of the
// grid-hosted inline modals — what each feature-row click mounts (title, prompt,
// confirm label), what Skip/No/Cancel dismisses WITHOUT side effects, and which
// handler each Confirm routes its targets through (popup/log effects).
// Owned elsewhere (do not re-pin here):
// - Feature-choice prompts (defensive_tactics / hunter_prey / damage_bonus):
//   CharSpecialActions.featureChoice.test.jsx.
// - Aspect-of-the-Wilds open/confirm/cancel and buff stamping:
//   CharSpecialActions.handlers.test.jsx.
// - Crafting distribution accounting (per-target grants, stock caps, log wording):
//   CharSpecialActions.craftingHandlers.test.jsx. This file keeps the meal/treat
//   OPEN/Skip/zero-stock refusals (craftingHandlers' header hands those here).
// - executeHandler popup-result rendering (buildAutomationPopupHtml):
//   automationClickHandlers/useMagicDevice lanes — the modals.test.jsx header's
//   "Popup ... handling" citation names this file, but popup-RESULT rendering is
//   owned there; here only null/undefined results + confirm-path popups live.
// - Portent apply-arg threading + die-apply error catch, and the Moonlight Step
//   YES slot-consume via confirmTeleport: CharSpecialActions.combatHandlers.test.jsx
//   (2026-11-27 overlap note: this file also witnesses those confirms as part of
//   its mount→confirm→popup seam tables).
// - Modal internals (arcane / elemental / combat / weapons onClose behaviour):
//   CharSpecialActions.modalOnClose.*.test.jsx.
// - Gnomish/elfish lineage chooser hosts: CharSpecialActions.gnomishLineage.test.jsx
//   (modals.test.jsx cites "lineage" to this file — stale; it lives there).
// - Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { addEntry } from '../../services/ui/logService.js';
import { confirmTeleport } from '../../services/automation/handlers/class-warlock/tempTeleportHandler.js';
import { applyPortentChoice } from '../../services/automation/handlers/class-wizard/portentHandler.js';
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js';
import { confirmBolsteringPerformance } from '../../services/automation/handlers/buffs/tempHpBuffHandler.js';
import { confirmEncouragingSong, skipEncouragingSong } from '../../services/automation/handlers/buffs/encouragingSongHandler.js';

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

// Render the sheet and click the feature row (rows render "Name:").
function renderAndClickRow(name, playerStats, props = {}) {
  render(<CharSpecialActions playerStats={playerStats} campaignName="test" {...props} />);
  fireEvent.click(screen.getByText(`${name}:`));
}

describe('CharSpecialActions - Inline Modal Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Capture popup writes (shared modalMocks default is an inert vi.fn setter).
    vi.mocked(useDiceRollPopup).mockReturnValue({
      setPopupHtml: (html) => { capturedPopup = html; },
    });
  });

  describe('Moonlight Step slot fallback', () => {
    const moonlightCases = [
      { label: 'Yes consumes the slot through confirmTeleport and shows its popup', button: 'Yes, Consume Slot', consumes: true },
      { label: 'No dismisses the prompt without consuming a slot', button: 'No', consumes: false },
    ];

    it.each(moonlightCases)(
      '$label',
      async ({ button, consumes }) => {
        const playerStats = createPlayerStats({
          specialActions: [
            { name: 'Moonlight Step', description: 'Teleport using Moonlight Step.', automation: { type: 'teleport', effect: 'moonlight_step_teleport' } },
          ],
        });
        executeHandler.mockResolvedValue({
          type: 'modal',
          modalName: 'moonlightStepFallback',
          payload: {
            action: { name: 'Moonlight Step' },
            playerStats,
            campaignName: 'test',
            slotLevel: 3,
          },
        });
        renderAndClickRow('Moonlight Step', playerStats);

        // Exact prompt copy, incl. the payload-interpolated slotLevel.
        await waitFor(() => {
          expect(screen.getByText('No Moonlight Step uses remaining. Consume a level 3 spell slot to use Moonlight Step?')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: button }));

        await waitFor(() => {
          expect(screen.queryByText(/Consume a level 3 spell slot/)).not.toBeInTheDocument();
        });

        if (consumes) {
          // Slot consumed via the warlock handler, and its popup confirms the step.
          expect(confirmTeleport).toHaveBeenCalledWith({ name: 'Moonlight Step' }, playerStats, 'test', false, 3);
          await waitFor(() => {
            expect(capturedPopup).toContain('Moonlight Step');
            expect(capturedPopup).toContain('Teleported.');
          });
        } else {
          expect(confirmTeleport).not.toHaveBeenCalled();
          expect(capturedPopup).toBeNull();
        }
      }
    );
  });

  describe('Portent Modal', () => {
    it('echoes the target, original roll and hit flag, applies the chosen die with the uncloned event data, and closes', async () => {
      const eventData = { d20: 15, bonus: 3, hit: true };
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'portentDiceChoice',
        payload: {
          targetName: 'Goblin',
          eventType: 'attack',
          eventData,
          diceOptions: [3, 7],
        },
      });
      renderAndClickRow('Portent', createPlayerStats({
        specialActions: [
          { name: 'Portent', description: 'Replace a roll.', automation: { type: 'portent' } },
        ],
      }));

      // PortentBlock is the real inline component: mount by testId, then pin
      // the display echoes threaded from the dispatched payload. The total and
      // the '(Hit)' flag are separate text nodes in one div — the matcher
      // joins child text nodes, so the composite regex pins BOTH.
      await screen.findByTestId('portent-modal');
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText(/d20\(15\) \+ 3 = 18 \(Hit\)/)).toBeInTheDocument();
      expect(screen.getByText('Choose a foretelling roll:')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '3' }));

      await waitFor(() => {
        expect(screen.queryByTestId('portent-modal')).not.toBeInTheDocument();
      });
      // Full object-destructure shape (the payload reached the handler
      // uncloned: eventData keeps reference identity through host + chooser).
      expect(applyPortentChoice).toHaveBeenCalledTimes(1);
      expect(applyPortentChoice.mock.calls[0][0]).toEqual({
        targetName: 'Goblin',
        eventType: 'attack',
        eventData,
        chosenDie: 3,
      });
      expect(applyPortentChoice.mock.calls[0][0].eventData).toBe(eventData);
      expect(capturedPopup).toContain('Portent');
      expect(capturedPopup).toContain('Die applied.');
    });

    // Cancel is the chooser's dismiss seam: closes with NOTHING applied, and
    // state fully clears so a re-click re-mounts the prompt.
    it('Cancel dismisses the chooser without applying a die or popping anything', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'portentDiceChoice',
        payload: {
          targetName: 'Goblin',
          eventType: 'attack',
          eventData: { d20: 15, bonus: 3, hit: true },
          diceOptions: [3, 7],
        },
      });
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Portent', description: 'Replace a roll.', automation: { type: 'portent' } },
        ],
      });
      renderAndClickRow('Portent', playerStats);
      await screen.findByTestId('portent-modal');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByTestId('portent-modal')).not.toBeInTheDocument();
      });
      expect(applyPortentChoice).not.toHaveBeenCalled();
      expect(capturedPopup).toBeNull();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('Creature-selection host (open, labels, skip)', () => {
    const celestialPayload = {
      action: { name: 'Celestial Resilience' },
      creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }],
      maxTargets: 5,
      selfTempHp: 10,
      allyTempHp: 5,
    };
    const performanceStats = createPlayerStats();
    const performancePayload = {
      action: { name: 'Bolstering Performance' },
      playerStats: performanceStats,
      campaignName: 'test',
      creatureTargets: [{ name: 'Ally1' }],
      maxTargets: 6,
      tempHp: 5,
    };
    const songStats = createPlayerStats();
    const songPayload = {
      action: { name: 'Encouraging Song' },
      playerStats: songStats,
      campaignName: 'test',
      creatureTargets: [{ name: 'Ally1' }],
      maxTargets: 2,
    };

    // Five features share the CreatureSelectionModal host: three via executeHandler
    // modal dispatch, two (chef/craft) via the local stock builders.
    const selectionHostCases = [
      {
        name: 'Celestial Resilience',
        automation: { type: 'celestial_resilience' },
        openResult: { type: 'modal', modalName: 'celestialResilienceModal', payload: celestialPayload },
        // Coupling pin (fix#158/fix#164 law): number from data, word
        // 'allies' from house copy. Producer default owned by
        // celestialResilienceHandler.js:70 (auto.maxAllies || 5).
        description: `Choose up to ${celestialPayload.maxTargets} allies to gain temporary hit points from your Celestial Resilience.`,
        note: /You gain 10 temporary hit points\. Each selected ally gains 5 temporary hit points\./,
        confirmLabel: 'Grant Resilience',
        // Typo regression pin (bug-shortrest-celestial-icon-typo): Font Awesome 6
        // has no `fa-shield-hart` glyph (renders content:none). Long-rest lane
        // (LongRestButton.jsx / modals/CelestialResilienceModal.jsx) is the
        // correct-class precedent.
        icon: 'fa-shield-heart',
        skipHandler: null,
        skipPopup: /No allies selected\./,
        confirm: {
          tempHpTargets: ['Ally1', 'Ally2'],
          amount: 5,
          logPattern: /grants 5 temporary hit points to Ally1, Ally2\./,
          popup: /Granted 5 temporary hit points to Ally1, Ally2\./,
        },
      },
      {
        name: 'Bolstering Performance',
        automation: { type: 'temp_hp_buff' },
        openResult: { type: 'modal', modalName: 'bolsteringPerformanceTarget', payload: performancePayload },
        // Coupling pin (fix#158/fix#164 law): number from data, word
        // 'allies' from house copy. Producer default owned by
        // tempHpBuffHandler.js:163 (auto.targets || 6).
        description: `Choose up to ${performancePayload.maxTargets} allies to gain temporary hit points.`,
        note: /Each target gains 5 temporary hit points\./,
        confirmLabel: 'Inspire',
        skipHandler: null,
        skipPopup: null,
        confirm: {
          handler: confirmBolsteringPerformance,
          args: [performancePayload.action, performanceStats, 'test', ['Ally1'], 5],
          popup: /Allies inspired\./,
        },
      },
      {
        name: 'Encouraging Song',
        automation: { type: 'heroic_inspiration_buff' },
        openResult: { type: 'modal', modalName: 'encouragingSongTarget', payload: songPayload },
        description: 'Choose up to your Proficiency Bonus allies to hear your song and gain Heroic Inspiration.',
        note: null,
        confirmLabel: 'Inspire',
        // Exact routed args: the skip handler receives the payload's own
        // action/stats references plus the sheet campaign.
        skipHandler: skipEncouragingSong,
        skipArgs: [songPayload.action, songStats, 'test'],
        skipPopup: /Skipped\./,
        confirm: {
          handler: confirmEncouragingSong,
          args: [songPayload.action, songStats, 'test', ['Ally1']],
          popup: /Allies inspired\./,
        },
      },
      {
        name: 'Replenishing Meal',
        automation: { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' },
        config: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
        stockKey: 'replenishingMeals',
        description: 'Choose creatures to receive a replenishing meal.',
        note: /Each creature can hold at most 1 meal\./,
        confirmLabel: 'Distribute Meals',
        skipHandler: null,
        skipPopup: null,
        zeroStockPopup: /No meals remaining\./,
      },
      {
        name: 'Bolstering Treats',
        automation: { type: 'temp_hp_buff', craftCount: true },
        config: { specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
        stockKey: 'chefBolsteringTreats',
        description: 'Choose creatures to receive a bolstering treat.',
        note: /Each creature can hold at most 1 treat\./,
        confirmLabel: 'Distribute Treats',
        skipHandler: null,
        skipPopup: null,
        zeroStockPopup: /No treats remaining\./,
      },
    ];

    function statsFor({ name, automation, config }) {
      return createPlayerStats({
        specialActions: [{ name, description: `${name} description.`, automation }],
        ...(config ? { automation: config } : {}),
      });
    }

    it.each(selectionHostCases)(
      'opens $name with its prompt and dismisses on Skip without side effects',
      async ({ name, automation, config, stockKey, openResult, description, note, confirmLabel, icon, skipHandler, skipArgs, skipPopup }) => {
        if (stockKey) mockRuntimeStore[stockKey] = 2;
        if (openResult) executeHandler.mockResolvedValue(openResult);

        renderAndClickRow(name, statsFor({ name, automation, config }), {
          characters: [{ name: 'Ally1' }, { name: 'Ally2' }],
        });

        await waitFor(() => {
          expect(screen.getByTestId('creature-selection-modal')).toBeInTheDocument();
        });
        // The row renders "$name:" — an exact match here is the modal's title span.
        expect(screen.getByText(name)).toBeInTheDocument();
        expect(screen.getByText(description)).toBeInTheDocument();
        if (note) expect(screen.getByText(note)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: confirmLabel })).toBeInTheDocument();
        if (icon) {
          // Header and confirm glyphs both carry the pinned class; the
          // `fa-shield-hart` typo must not reappear at either site.
          expect(screen.getByTestId('cs-header-icon')).toHaveClass('fa-shield-heart');
          expect(screen.getByTestId('cs-confirm-icon')).toHaveClass('fa-shield-heart');
          expect(document.querySelector('.fa-shield-hart')).toBeNull();
        }

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        await waitFor(() => {
          expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        });
        if (skipHandler) {
          expect(skipHandler).toHaveBeenCalledTimes(1);
          expect(skipHandler).toHaveBeenCalledWith(...skipArgs);
        }
        if (skipPopup) expect(capturedPopup).toMatch(skipPopup);
        else expect(capturedPopup).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
      }
    );

    // Drift arms (fix#164 recipe): copy and enforcement must read the SAME
    // payload maxTargets — a re-typed literal in copy goes RED when the
    // producer number shifts. Default arms above stay live (celestial 5 via
    // celestialResilienceHandler.js:70 auto.maxAllies || 5; performance 6
    // via tempHpBuffHandler.js:163 auto.targets || 6 — defaults producer-owned).
    const driftCouplingCases = [
      {
        name: 'Celestial Resilience',
        automation: { type: 'celestial_resilience' },
        modalName: 'celestialResilienceModal',
        basePayload: celestialPayload,
        maxTargets: 3,
      },
      {
        name: 'Bolstering Performance',
        automation: { type: 'temp_hp_buff' },
        modalName: 'bolsteringPerformanceTarget',
        basePayload: performancePayload,
        maxTargets: 2,
      },
    ];

    it.each(driftCouplingCases)(
      '$name copy interpolates live maxTargets=$maxTargets and equals the picker cap',
      async ({ name, automation, modalName, basePayload, maxTargets }) => {
        executeHandler.mockResolvedValue({ type: 'modal', modalName, payload: { ...basePayload, maxTargets } });

        renderAndClickRow(name, statsFor({ name, automation }), {
          characters: [{ name: 'Ally1' }, { name: 'Ally2' }],
        });

        // Drift leg: the SAME payload field drives the copy — a re-typed
        // literal '5'/'6' in the house copy goes RED when the producer number
        // shifts. The picker cap itself is not rendered by the shared modal
        // mock, so the copy node is the only observable (no second re-parse of
        // the same textContent).
        const copy = await screen.findByText(/Choose up to \d+ allies/);
        expect(copy).toHaveTextContent(`Choose up to ${maxTargets} allies`);
      }
    );

    const confirmCases = selectionHostCases.filter(c => c.confirm);

    it.each(confirmCases)(
      'confirming $name routes its targets through the apply path and shows its popup',
      async ({ name, automation, config, stockKey, openResult, confirmLabel, confirm }) => {
        if (stockKey) mockRuntimeStore[stockKey] = 2;
        if (openResult) executeHandler.mockResolvedValue(openResult);

        renderAndClickRow(name, statsFor({ name, automation, config }), {
          characters: [{ name: 'Ally1' }, { name: 'Ally2' }],
        });

        await waitFor(() => {
          expect(screen.getByRole('button', { name: confirmLabel })).toBeInTheDocument();
        });
        // The shared modal mock confirms with ALL listed targets.
        fireEvent.click(screen.getByRole('button', { name: confirmLabel }));

        await waitFor(() => {
          expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        });

        if (confirm.handler) {
          expect(confirm.handler).toHaveBeenCalledWith(...confirm.args);
        } else {
          for (const target of confirm.tempHpTargets) {
            expect(setTempHp).toHaveBeenCalledWith(target, confirm.amount, 'test');
          }
          expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestCharacter',
            abilityName: name,
            description: expect.stringMatching(confirm.logPattern),
          }));
        }
        await waitFor(() => {
          expect(capturedPopup).toMatch(confirm.popup);
        });
      }
    );

    const refusalCases = selectionHostCases.filter(c => c.zeroStockPopup);

    it.each(refusalCases)(
      '$name with empty stock refuses via popup and never opens the modal',
      async ({ name, automation, config, stockKey, zeroStockPopup }) => {
        mockRuntimeStore[stockKey] = 0;

        renderAndClickRow(name, statsFor({ name, automation, config }), {
          characters: [{ name: 'Ally1' }],
        });

        await waitFor(() => {
          expect(capturedPopup).toMatch(zeroStockPopup);
        });
        expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        expect(setRuntimeValue).not.toHaveBeenCalled();
      }
    );
  });

  describe('Fiendish Resilience', () => {
    it('dismisses the resistance prompt without applying anything and remounts it on the next click', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'fiendishResilience',
        payload: {
          action: { name: 'Fiendish Resilience' },
          damageTypes: ['Fire', 'Cold'],
        },
      });
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Fiendish Resilience', description: 'Choose a damage resistance.', automation: { type: 'fiendish_resilience' } },
        ],
      });
      renderAndClickRow('Fiendish Resilience', playerStats);

      await waitFor(() => {
        expect(screen.getByTestId('single-resistance-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => {
        expect(screen.queryByTestId('single-resistance-modal')).not.toBeInTheDocument();
      });
      // Dismiss applies nothing: no resistance write, no popup.
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(capturedPopup).toBeNull();

      // State is fully cleared — clicking the feature re-runs and mounts a fresh prompt.
      fireEvent.click(screen.getByText('Fiendish Resilience:'));
      await waitFor(() => {
        expect(screen.getByTestId('single-resistance-modal')).toBeInTheDocument();
        expect(executeHandler).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('executeHandler null/undefined handling', () => {
    // Probe by MOUNT testId: the row label's node text is `Name:` (name and
    // colon are separate text nodes), so a plain-name text matcher would never
    // match and the negative assertion would be VACUOUS. Positive controls
    // exist for both testIds: DestructiveStrideModal in modals.test.jsx's
    // census, PortentBlock in the Portent Modal suite above.
    const nullCases = [
      { name: 'Destructive Stride', automation: { type: 'destructive_stride' }, testId: 'destructive-stride-modal' },
      { name: 'Portent', automation: { type: 'portent' }, testId: 'portent-modal' },
    ];

    it.each(nullCases.flatMap(c => [
      { ...c, result: null, resultLabel: 'null' },
      { ...c, result: undefined, resultLabel: 'undefined' },
    ]))('handles executeHandler returning $resultLabel for $name silently without opening its modal', async ({ name, automation, testId, result }) => {
      executeHandler.mockResolvedValue(result);

      renderAndClickRow(name, createPlayerStats({
        specialActions: [
          { name, description: `${name} description.`, automation },
        ],
      }));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });

      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      expect(capturedPopup).toBeNull();
    });
  });
});
