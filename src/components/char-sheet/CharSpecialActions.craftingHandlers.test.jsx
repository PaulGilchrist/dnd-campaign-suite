// @maintained-by-ai
// CharSpecialActions crafting lane (seam map #68): the Replenishing Meal and
// Bolstering Treats CONFIRM/DISTRIBUTE contract — per-target grants, crafter
// stock decrement, campaign log, confirmation popup, and capping grants at the
// remaining stock.
// Owned elsewhere (do not re-pin here):
// - Modal open rendering, Skip-close, and zero-stock "No meals/treats remaining"
//   refusals: CharSpecialActions.modalsInline.test.jsx.
// - brew_poison click refusals/success: CharSpecialActions.automationClickHandlers.test.jsx (#69).
// - Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
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

// Two crafting features sharing one distribution seam, driven by different
// automation configs (meal passive vs chef temp_hp_buff special action).
const craftingFeatures = [
  {
    name: 'Replenishing Meal',
    stockKey: 'replenishingMeals',
    targetKey: 'replenishingMeals',
    automation: { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' },
    config: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
    modalButton: 'Distribute Meals',
    itemSingular: 'replenishing meal',
    popupSingular: 'meal',
  },
  {
    name: 'Bolstering Treats',
    stockKey: 'chefBolsteringTreats',
    targetKey: 'bolsteringTreat',
    automation: { type: 'temp_hp_buff', craftCount: true },
    config: { specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
    modalButton: 'Distribute Treats',
    itemSingular: 'bolstering treat',
    popupSingular: 'treat',
  },
];

// Distribution scenarios across the stock/selection boundary:
// all selected targets fit, both fit with stock left over, and selection
// exceeds stock so later targets are refused.
const scenarios = [
  {
    label: 'single target, decrements stock and confirms in singular form',
    stock: 2,
    characters: ['Ally1'],
    granted: ['Ally1'],
    expectedStock: 1,
  },
  {
    label: 'multiple targets, decrements by the count in plural form',
    stock: 3,
    characters: ['Ally1', 'Ally2'],
    granted: ['Ally1', 'Ally2'],
    expectedStock: 1,
  },
  {
    label: 'caps grants at remaining stock when more targets are selected',
    stock: 1,
    characters: ['Ally1', 'Ally2'],
    granted: ['Ally1'],
    expectedStock: 0,
  },
];

const distributeCases = craftingFeatures.flatMap(feature =>
  scenarios.map(scenario => ({ ...feature, ...scenario }))
);

describe('CharSpecialActions - Crafting Distribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Capture popup writes (shared modalMocks default is an inert vi.fn setter).
    vi.mocked(useDiceRollPopup).mockReturnValue({
      setPopupHtml: (html) => { capturedPopup = html; },
    });
  });

  it.each(distributeCases)(
    'distributes $name: $label',
    async ({ name, stockKey, targetKey, automation, config, modalButton, itemSingular, popupSingular, stock, characters, granted, expectedStock }) => {
      mockRuntimeStore[stockKey] = stock;

      const playerStats = {
        ...basePlayerStats,
        specialActions: [{ name, description: 'Distribute.', automation }],
        automation: config,
      };
      render(
        <CharSpecialActions
          playerStats={playerStats}
          campaignName="test"
          characters={characters.map(n => ({ name: n }))}
        />
      );

      fireEvent.click(screen.getByText(new RegExp(name)));

      await waitFor(() => {
        expect(screen.getByText(modalButton)).toBeInTheDocument();
      });

      // The shared modal mock confirms with ALL listed targets.
      fireEvent.click(screen.getByText(modalButton));

      await waitFor(() => {
        expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
      });

      const count = granted.length;
      const plural = count > 1 ? 's' : '';

      // Every granted target receives exactly 1 unit of the resource;
      // targets beyond the stock are refused nothing.
      for (const target of characters) {
        if (granted.includes(target)) {
          expect(setRuntimeValue).toHaveBeenCalledWith(target, targetKey, 1, 'test');
        } else {
          expect(setRuntimeValue).not.toHaveBeenCalledWith(target, targetKey, 1, 'test');
        }
      }

      // Crafter's stock decremented by the number actually granted.
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', stockKey, expectedStock, 'test');

      // Campaign log entry names the character, feature, and recipients.
      expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCharacter',
        abilityName: name,
        description: expect.stringContaining(`distributed ${count} ${itemSingular}${plural} to ${granted.join(', ')}`),
      }));

      // Confirmation popup reports the grant.
      expect(capturedPopup).toContain(`Granted ${count} ${popupSingular}${plural} to: ${granted.join(', ')}.`);
    },
  );
});
