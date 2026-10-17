// @maintained-by-ai
// CharSpecialActions automation-click lane:
// - brew_poison delegated click (useBrewPoison guards + success mutation) — unique to this file;
//   clicking brew_poison must short-circuit via AUTOMATION_CLICK_DELEGATES, never executeHandler.
// - Direct executeHandler popup-result rendering incl. fallback name (CharSpecialActions.jsx
//   buildAutomationPopupHtml seam) — pinned here per modals.test.jsx handoff comment.
// - executeHandler MODAL results (teleport etc.) are owned by modals.test.jsx modalTests
//   (parametrized click → testId rendering); confirm-path popups by signatureSpellsPopup /
//   handlers / modalsInline lanes. Do not re-pin those here.
// - Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';

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

function createSpecialAction(name, automation) {
  return { name, description: `${name} description.`, automation };
}

// Brew Poison requires the Poisoner feat automation config; max doses = proficiency (2).
const brewPoisonStats = (inventory) => createPlayerStats({
  specialActions: [createSpecialAction('Brew Poison', { type: 'brew_poison' })],
  automation: { specialActions: [{ type: 'brew_poison', name: 'Brew Poison' }] },
  inventory,
});

function renderAndClick(playerStats, actionName) {
  render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" />);
  fireEvent.click(screen.getAllByText(new RegExp(actionName))[0]);
}

const KIT_BACKPACK = ["Poisoner's Kit"];

// Refusal guards for brew_poison: distinct popup message per branch, no state mutation.
// Needles are unique per message in CharSpecialActions.jsx useBrewPoison.
const brewPoisonRefusals = [
  {
    label: 'already at max doses',
    setup: { poisonDoses: 2, gold: 100 },
    inventory: { equipped: [], backpack: KIT_BACKPACK },
    needle: 'already at maximum (2/2)',
  },
  {
    label: 'missing Poisoner\'s Kit',
    setup: { poisonDoses: 0, gold: 100 },
    inventory: { equipped: [], backpack: [] },
    needle: "You need a Poisoner's Kit in your inventory",
  },
  {
    label: 'insufficient gold',
    setup: { poisonDoses: 0, gold: 30 },
    inventory: { equipped: [], backpack: KIT_BACKPACK },
    needle: 'You need at least 50 GP to brew poison. You have 30 GP.',
  },
];

describe('CharSpecialActions - handleAutomationClick branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Capture popup writes (shared modalMocks default is an inert vi.fn setter).
    vi.mocked(useDiceRollPopup).mockReturnValue({
      setPopupHtml: (html) => { capturedPopup = html; },
    });
  });

  describe('brew_poison (delegated click, never reaches executeHandler)', () => {
    it('brews doses to proficiency max, deducts 50 GP, logs, and confirms via popup', async () => {
      mockRuntimeStore.poisonDoses = 0;
      mockRuntimeStore.gold = 100;

      renderAndClick(brewPoisonStats({ equipped: [], backpack: KIT_BACKPACK }), 'Brew Poison');

      await waitFor(() => {
        expect(capturedPopup).toContain('Brewed 2 poison doses');
      });
      expect(capturedPopup).toContain("Poisoner's Kit");
      expect(capturedPopup).toContain('50 GP');
      // Runtime state mutations: doses filled to max (proficiency), 50 GP deducted.
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'poisonDoses', 2, 'test-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'gold', 50, 'test-campaign');
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCharacter',
        abilityName: 'Brew Poison',
      }));
      // Delegation seam: brew_poison is handled component-local, not via the handler hub.
      expect(executeHandler).not.toHaveBeenCalled();
    });

    it.each(brewPoisonRefusals)(
      'refuses to brew when $label and mutates nothing',
      async ({ setup, inventory, needle }) => {
        Object.assign(mockRuntimeStore, setup);

        renderAndClick(brewPoisonStats(inventory), 'Brew Poison');

        await waitFor(() => {
          expect(capturedPopup).toContain(needle);
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(executeHandler).not.toHaveBeenCalled();
      },
    );
  });

  describe('executeHandler popup results', () => {
    it.each([
      {
        label: 'renders payload name and description',
        actionName: 'Test Action',
        payload: { name: 'Charged Release', description: 'Action completed.' },
        expectedName: 'Charged Release',
      },
      {
        label: 'falls back to the action name when payload.name is missing',
        actionName: 'Fallback Action',
        payload: { description: 'No name provided.' },
        expectedName: 'Fallback Action',
      },
    ])('$label', async ({ actionName, payload, expectedName }) => {
      executeHandler.mockResolvedValue({ type: 'popup', payload });

      renderAndClick(
        createPlayerStats({ specialActions: [createSpecialAction(actionName, { type: 'generic' })] }),
        actionName,
      );

      await waitFor(() => {
        expect(capturedPopup).toContain(expectedName);
      });
      expect(capturedPopup).toContain(payload.description);
      expect(executeHandler).toHaveBeenCalledTimes(1);
    });
  });
});
