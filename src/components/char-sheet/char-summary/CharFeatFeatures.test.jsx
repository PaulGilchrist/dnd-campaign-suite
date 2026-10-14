// @maintained-by-ai
/**
 * CharFeatFeatures — visibility of feat-tracked resource rows and their
 * getMax() formulas.
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

function expectRowWired(text, resourceKey) {
  const row = screen.getByText(text);
  expect(row).toBeInTheDocument();
  expect(row.closest('[data-resource-key]')).toHaveAttribute('data-resource-key', resourceKey);
}

describe('CharFeatFeatures', () => {
  beforeEach(() => {
    runtimeStores.clear();
  });

  it.each([
    ['no feats, no automation at all (undefined must not crash)', statsWith({ automation: undefined }), {}],
    ['Lucky taken but proficiency is 0, even with points stored', statsWith({ feats: ['Lucky'], proficiency: 0 }), { luckyPoints: 5 }],
    ['chef action and meal passive exist but every tracked resource is 0', statsWith({ automation: { specialActions: [CHEF_TREATS], passives: [REPLENISHING_MEAL] } }), { chefBolsteringTreats: 0, replenishingMeals: 0, bolsteringTreat: 0 }],
    ['resources stored without any feats or actions to unlock them', statsWith(), { luckyPoints: 3, poisonDoses: 5, chefBolsteringTreats: 5, poisonedWeaponsActive: true }],
  ])('renders nothing when %s', (_name, stats, store) => {
    seedRuntime(store);
    renderSheet(stats);
    expect(screen.queryByTestId('char-feat-features')).not.toBeInTheDocument();
  });

  it.each(['Lucky', 'lucky'])(
    'shows Luck Points for feat "%s" with proficiency as the max, even with no points stored',
    (feat) => {
      renderSheet(statsWith({ feats: [feat] }));
      expectRowWired('Luck Points: 3', 'luckyPoints');
    }
  );

  it('always shows Poison Doses for the brew_poison action, even at 0 stored doses', () => {
    seedRuntime({ poisonDoses: 0 });
    renderSheet(statsWith({ automation: { specialActions: [BREW_POISON], passives: [] } }));
    expectRowWired('Poison Doses: 3', 'poisonDoses');
  });

  it('shows and hides the Poisoned Weapons badge with poisonedWeaponsActive', () => {
    const stats = statsWith({ automation: { specialActions: [BREW_POISON], passives: [] } });
    seedRuntime({ poisonedWeaponsActive: true });
    const { rerender } = renderSheet(stats);
    const badge = screen.getByText('Poisoned Weapons active');
    expect(badge).toHaveClass('automation-badge');
    expect(badge.querySelector('i.fa-solid.fa-vial')).toBeInTheDocument();

    seedRuntime({ poisonDoses: 1 }); // flag now unset — row stays, badge goes
    rerender(<CharFeatFeatures playerStats={stats} campaignName={CAMPAIGN} />);
    expect(screen.queryByText('Poisoned Weapons active')).not.toBeInTheDocument();
    expect(screen.getByText('Poison Doses: 3')).toBeInTheDocument();
  });

  it.each([
    ['matching passive and stored below the cap', REPLENISHING_MEAL, 2, 'Replenishing Meals: 7'],
    ['matching passive and stored above the cap', REPLENISHING_MEAL, 10, 'Replenishing Meals: 10'],
    ['non-matching passive name falls back to max 1', { ...REPLENISHING_MEAL, name: 'Other Passive' }, 2, 'Replenishing Meals: 1'],
  ])('computes Replenishing Meals max from %s', (_name, passive, stored, expected) => {
    seedRuntime({ replenishingMeals: stored });
    renderSheet(statsWith({ automation: { specialActions: [], passives: [passive] } }));
    expectRowWired(expected, 'replenishingMeals');
  });

  it.each([
    ['proficiency as the max', 3, 2, 'Bolstering Treats: 3'],
    ['stored count as the max when proficiency is 0', 0, 2, 'Bolstering Treats: 2'],
  ])('shows chef Bolstering Treats with %s', (_name, proficiency, stored, expected) => {
    seedRuntime({ chefBolsteringTreats: stored });
    renderSheet(statsWith({ proficiency, automation: { specialActions: [CHEF_TREATS], passives: [] } }));
    expectRowWired(expected, 'chefBolsteringTreats');
  });

  it('shows a standalone Bolstering Treat row (max 1) received from a chef', () => {
    seedRuntime({ bolsteringTreat: 1 });
    renderSheet();
    expectRowWired('Bolstering Treat: 1', 'bolsteringTreat');
  });

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
      bolsteringTreat: 0,
    });
    const { container } = renderSheet(stats);

    const keys = [...container.querySelectorAll('[data-resource-key]')].map(el => el.getAttribute('data-resource-key'));
    expect(keys).toEqual(['luckyPoints', 'poisonDoses', 'replenishingMeals', 'chefBolsteringTreats']);
    expect(screen.getByText('Poison Doses: 3')).toBeInTheDocument();
    expect(screen.getByText('Replenishing Meals: 7')).toBeInTheDocument();
    expect(screen.queryByText('Poisoned Weapons active')).not.toBeInTheDocument();
  });
});
