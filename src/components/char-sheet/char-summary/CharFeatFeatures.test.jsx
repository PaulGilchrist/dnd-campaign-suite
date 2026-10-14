// @improved-by-ai
/**
 * CharFeatFeatures — visibility of feat-tracked resource rows.
 *
 * Seam mocks (this unit owns WHICH rows render and their getMax() results;
 * TrackedResourceInput's internal editing behavior is covered by its own
 * TrackedResourceInput.test.jsx):
 *  - useRuntimeValue: backed by a per-character Map, matching the real
 *    getRuntimeValue contract of returning null for missing keys.
 *  - TrackedResourceInput: renders "<label>: <getMax()>" and tags itself
 *    with data-resource-key so label↔store-key wiring can be asserted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CharFeatFeatures from './CharFeatFeatures.jsx';

const { runtimeStores } = vi.hoisted(() => ({ runtimeStores: new Map() }));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: (characterKey, key) => {
    const store = runtimeStores.get(characterKey);
    return store && key in store ? store[key] : null;
  },
}));

vi.mock('./TrackedResourceInput.jsx', () => {
  const MockTrackedResourceInput = ({ label, resourceKey, getMax }) => {
    const max = getMax ? getMax() : 0;
    return React.createElement('div', { 'data-resource-key': resourceKey }, `${label}: ${max}`);
  };
  return { default: MockTrackedResourceInput };
});

const CAMPAIGN = 'test-campaign';
const CHAR_NAME = 'TestCharacter';

// Automation signatures the component detects (mirrors data shapes from automation config)
const BREW_POISON = { type: 'brew_poison', name: 'Brew Poison' };
const CHEF_TREATS = { type: 'temp_hp_buff', name: 'Bolstering Treats' };
const REPLENISHING_MEAL = { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' };

function statsWith(overrides = {}) {
  return {
    name: CHAR_NAME,
    proficiency: 3,
    feats: [],
    automation: { specialActions: [], passives: [] },
    ...overrides,
  };
}

function seedRuntime(values) {
  runtimeStores.set(CHAR_NAME, { ...values });
}

function renderSheet(stats = statsWith()) {
  return render(<CharFeatFeatures playerStats={stats} campaignName={CAMPAIGN} />);
}

function expectNothingRendered() {
  expect(screen.queryByTestId('char-feat-features')).not.toBeInTheDocument();
}

describe('CharFeatFeatures', () => {
  beforeEach(() => {
    runtimeStores.clear();
  });

  describe('empty state', () => {
    it('renders nothing when no feat resources are active', () => {
      renderSheet();
      expectNothingRendered();
    });

    it('renders nothing when automation is undefined', () => {
      renderSheet(statsWith({ automation: undefined }));
      expectNothingRendered();
    });

    it('renders nothing when Lucky feat is taken but proficiency is 0 (Luck Points max would be 0)', () => {
      seedRuntime({ luckyPoints: 5 });
      renderSheet(statsWith({ feats: ['Lucky'], proficiency: 0 }));
      expectNothingRendered();
    });
  });

  describe('lucky feat', () => {
    it('shows Luck Points with proficiency as the max, even when stored points are 0', () => {
      seedRuntime({ luckyPoints: 0 });
      renderSheet(statsWith({ feats: ['Lucky'] }));
      expect(screen.getByText('Luck Points: 3')).toBeInTheDocument();
      expect(screen.getByText('Luck Points: 3').closest('[data-resource-key]')).toHaveAttribute('data-resource-key', 'luckyPoints');
    });

    it('detects Lucky feat case-insensitively', () => {
      renderSheet(statsWith({ feats: ['lucky'] }));
      expect(screen.getByText('Luck Points: 3')).toBeInTheDocument();
    });

    it('does not show Luck Points when a different feat is taken, even with points stored', () => {
      seedRuntime({ luckyPoints: 3 });
      renderSheet(statsWith({ feats: ['Alert'] }));
      expectNothingRendered();
    });
  });

  describe("poisoner feat — Poison Doses", () => {
    it('shows Poison Doses with proficiency as the max when Brew Poison action exists', () => {
      seedRuntime({ poisonDoses: 2 });
      renderSheet(statsWith({ automation: { specialActions: [BREW_POISON], passives: [] } }));
      expect(screen.getByText('Poison Doses: 3')).toBeInTheDocument();
      expect(screen.getByText('Poison Doses: 3').closest('[data-resource-key]')).toHaveAttribute('data-resource-key', 'poisonDoses');
    });

    it('shows Poison Doses even when current doses are 0 (so the player can brew more)', () => {
      seedRuntime({ poisonDoses: 0 });
      renderSheet(statsWith({ automation: { specialActions: [BREW_POISON], passives: [] } }));
      expect(screen.getByText('Poison Doses: 3')).toBeInTheDocument();
    });

    it('omits Poison Doses when the Brew Poison action is absent, even with doses stored', () => {
      seedRuntime({ poisonDoses: 5 });
      renderSheet();
      expect(screen.queryByText(/Poison Doses/)).not.toBeInTheDocument();
    });
  });

  describe('poisoned weapons badge', () => {
    it('shows the active badge when poisonedWeaponsActive is true', () => {
      seedRuntime({ poisonDoses: 2, poisonedWeaponsActive: true });
      renderSheet(statsWith({ automation: { specialActions: [BREW_POISON], passives: [] } }));
      const badge = screen.getByText('Poisoned Weapons active');
      expect(badge.closest('span')).toHaveClass('automation-badge');
      expect(badge.querySelector('i.fa-solid.fa-vial')).toBeInTheDocument();
    });

    it('omits the badge when poisonedWeaponsActive is false or unset', () => {
      seedRuntime({ poisonDoses: 2, poisonedWeaponsActive: false });
      const { unmount } = renderSheet(statsWith({ automation: { specialActions: [BREW_POISON], passives: [] } }));
      expect(screen.queryByText('Poisoned Weapons active')).not.toBeInTheDocument();

      unmount();
      seedRuntime({ poisonDoses: 2 });
      renderSheet(statsWith({ automation: { specialActions: [BREW_POISON], passives: [] } }));
      expect(screen.queryByText('Poisoned Weapons active')).not.toBeInTheDocument();
    });
  });

  describe('chef feat — Bolstering Treats', () => {
    it('shows Bolstering Treats with proficiency as the max when the chef action exists', () => {
      seedRuntime({ chefBolsteringTreats: 2 });
      renderSheet(statsWith({ automation: { specialActions: [CHEF_TREATS], passives: [] } }));
      expect(screen.getByText('Bolstering Treats: 3')).toBeInTheDocument();
      expect(screen.getByText('Bolstering Treats: 3').closest('[data-resource-key]')).toHaveAttribute('data-resource-key', 'chefBolsteringTreats');
    });

    it('falls back to the stored treat count as the max when proficiency is 0', () => {
      seedRuntime({ chefBolsteringTreats: 2 });
      renderSheet(statsWith({ proficiency: 0, automation: { specialActions: [CHEF_TREATS], passives: [] } }));
      expect(screen.getByText('Bolstering Treats: 2')).toBeInTheDocument();
    });

    it('omits chef Bolstering Treats when no treats are stored, even with the chef action', () => {
      seedRuntime({ chefBolsteringTreats: 0 });
      renderSheet(statsWith({ automation: { specialActions: [CHEF_TREATS], passives: [] } }));
      expectNothingRendered();
    });
  });

  describe('replenishing meals', () => {
    it('shows max of 4 + proficiency when the matching passive exists', () => {
      seedRuntime({ replenishingMeals: 2 });
      renderSheet(statsWith({ automation: { specialActions: [], passives: [REPLENISHING_MEAL] } }));
      expect(screen.getByText('Replenishing Meals: 7')).toBeInTheDocument();
      expect(screen.getByText('Replenishing Meals: 7').closest('[data-resource-key]')).toHaveAttribute('data-resource-key', 'replenishingMeals');
    });

    it('keeps the stored count as the max when it exceeds 4 + proficiency', () => {
      seedRuntime({ replenishingMeals: 10 });
      renderSheet(statsWith({ automation: { specialActions: [], passives: [REPLENISHING_MEAL] } }));
      expect(screen.getByText('Replenishing Meals: 10')).toBeInTheDocument();
    });

    it('shows a max of 1 when meals are stored but the passive name does not match', () => {
      seedRuntime({ replenishingMeals: 2 });
      renderSheet(statsWith({
        automation: { specialActions: [], passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Other Passive' }] },
      }));
      expect(screen.getByText('Replenishing Meals: 1')).toBeInTheDocument();
    });

    it('omits Replenishing Meals when the stored value is 0, even with the matching passive', () => {
      seedRuntime({ replenishingMeals: 0 });
      renderSheet(statsWith({ automation: { specialActions: [], passives: [REPLENISHING_MEAL] } }));
      expectNothingRendered();
    });
  });

  describe('standalone bolstering treat (received from a chef)', () => {
    it('shows the treat row with max of 1 when bolsteringTreat > 0 and no feats are active', () => {
      seedRuntime({ bolsteringTreat: 1 });
      renderSheet();
      const row = screen.getByText('Bolstering Treat: 1');
      expect(row).toBeInTheDocument();
      expect(row.closest('[data-resource-key]')).toHaveAttribute('data-resource-key', 'bolsteringTreat');
    });

    it('omits the treat row when bolsteringTreat is 0', () => {
      seedRuntime({ bolsteringTreat: 0 });
      renderSheet();
      expectNothingRendered();
    });
  });

  describe('multiple features combined', () => {
    it('renders each active resource row exactly once, paired with the correct store key', () => {
      const stats = statsWith({
        feats: ['Lucky'],
        automation: {
          specialActions: [BREW_POISON, CHEF_TREATS],
          passives: [REPLENISHING_MEAL],
        },
      });
      seedRuntime({
        luckyPoints: 2,
        poisonDoses: 1,
        poisonedWeaponsActive: false,
        chefBolsteringTreats: 3,
        replenishingMeals: 2,
      });
      const { container } = renderSheet(stats);

      expect(screen.getByText('Luck Points: 3')).toBeInTheDocument();
      expect(screen.getByText('Poison Doses: 3')).toBeInTheDocument();
      expect(screen.getByText('Bolstering Treats: 3')).toBeInTheDocument();
      expect(screen.getByText('Replenishing Meals: 7')).toBeInTheDocument();

      const keys = [...container.querySelectorAll('[data-resource-key]')].map(el => el.getAttribute('data-resource-key'));
      expect(keys).toEqual(expect.arrayContaining(['luckyPoints', 'poisonDoses', 'chefBolsteringTreats', 'replenishingMeals']));
      expect(keys).not.toContain('bolsteringTreat');
      expect(keys.filter(k => k === 'chefBolsteringTreats')).toHaveLength(1);
      expect(screen.queryByText('Poisoned Weapons active')).not.toBeInTheDocument();
    });
  });
});
