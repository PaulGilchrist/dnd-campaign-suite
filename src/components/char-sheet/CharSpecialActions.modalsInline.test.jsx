// @maintained-by-ai
// CharSpecialActions inline modal-host lane: the mount/dismiss/confirm seams of the
// grid-hosted inline modals — what each feature-row click mounts (title, prompt,
// confirm label), what Skip/No dismisses WITHOUT side effects, and which handler each
// Confirm routes its targets through (popup/log effects).
// Owned elsewhere (do not re-pin here):
// - Feature-choice prompts (defensive_tactics / hunter_prey / damage_bonus):
//   CharSpecialActions.featureChoice.test.jsx.
// - Aspect-of-the-Wilds open/confirm/cancel and buff stamping:
//   CharSpecialActions.handlers.test.jsx.
// - Crafting distribution accounting (per-target grants, stock caps, log wording):
//   CharSpecialActions.craftingHandlers.test.jsx.
// - Modal internals (arcane / elemental / combat / weapons onClose behaviour):
//   CharSpecialActions.modalOnClose.*.test.jsx.
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

        await waitFor(() => {
          expect(screen.getByText(/Consume a level 3 spell slot/)).toBeInTheDocument();
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
    it('shows the original roll, applies the chosen foretelling die, and closes', async () => {
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
      renderAndClickRow('Portent', createPlayerStats({
        specialActions: [
          { name: 'Portent', description: 'Replace a roll.', automation: { type: 'portent' } },
        ],
      }));

      await waitFor(() => {
        expect(screen.getByText(/d20\(15\) \+ 3 = 18/)).toBeInTheDocument();
      });
      expect(screen.getByText(/Hit/)).toBeInTheDocument();
      expect(screen.getByText('Choose a foretelling roll:')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '3' }));

      await waitFor(() => {
        expect(screen.queryByText(/Choose a foretelling roll/)).not.toBeInTheDocument();
      });
      expect(applyPortentChoice).toHaveBeenCalledWith(expect.objectContaining({
        targetName: 'Goblin',
        eventType: 'attack',
        chosenDie: 3,
      }));
      expect(capturedPopup).toContain('Portent');
      expect(capturedPopup).toContain('Die applied.');
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
        description: 'Choose up to 5 allies to gain temporary hit points from your Celestial Resilience.',
        note: /You gain 10 temporary hit points\. Each selected ally gains 5 temporary hit points\./,
        confirmLabel: 'Grant Resilience',
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
        description: 'Choose up to 6 allies to gain temporary hit points.',
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
        skipHandler: skipEncouragingSong,
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
      async ({ name, automation, config, stockKey, openResult, description, note, confirmLabel, skipHandler, skipPopup }) => {
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

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        await waitFor(() => {
          expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        });
        if (skipHandler) expect(skipHandler).toHaveBeenCalled();
        if (skipPopup) expect(capturedPopup).toMatch(skipPopup);
        else expect(capturedPopup).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
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
    const nullCases = [
      // PortentBlock is the real inline component (no testid) — probe by its marker text.
      { name: 'Destructive Stride', automation: { type: 'destructive_stride' }, marker: 'Destructive Stride' },
      { name: 'Portent', automation: { type: 'portent' }, marker: /Choose a foretelling roll/ },
    ];

    it.each(nullCases.flatMap(c => [
      { ...c, result: null, resultLabel: 'null' },
      { ...c, result: undefined, resultLabel: 'undefined' },
    ]))('handles executeHandler returning $resultLabel for $name silently without opening its modal', async ({ name, automation, marker, result }) => {
      executeHandler.mockResolvedValue(result);

      renderAndClickRow(name, createPlayerStats({
        specialActions: [
          { name, description: `${name} description.`, automation },
        ],
      }));

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });

      expect(screen.queryByText(marker)).not.toBeInTheDocument();
      expect(capturedPopup).toBeNull();
    });
  });
});
