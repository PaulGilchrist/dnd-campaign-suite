//
// CLEANING SUMMARY:
//
// Removed:
//   - FeatureChoiceModal early return test (line ~421): redundant with
//     CharSpecialActions.featureChoice.test.jsx which tests the same
//     behavior with more thorough assertions (open/close, handler calls,
//     runtime state updates). No behavioral gap.
//
//   - MoonlightStepFallback onClose test (line ~637): fully covered by
//     CharSpecialActions.combatHandlers.test.jsx which tests the same
//     modal close path. No behavioral gap.
//
// Consolidated:
//   - Bolstering Performance and Encouraging Song modal early return tests
//     (lines ~471-535) merged into a single parameterized test. Both tests
//     followed identical structure: click action → executeHandler returns
//     popup → assert no creature-selection-modal. Parameterized to cover
//     both automation types in one test with a clear data table.
//
// Kept:
//   - useEffect cancelled guard test: valuable behavioral coverage for the
//     cleanup pattern (let cancelled = false; return () => { cancelled = true; }).
//     Brittle due to unmount-during-async pattern, but tests a real edge case
//     that would cause a console error if broken. Acceptable fragility for
//     the confidence it provides.
//
//   - Action filtering tests (6 tests): most comprehensive dedup/cross-list
//     coverage in the entire test suite. Tests cover filtering across all
//     four action lists (actions, bonusActions, reactions, characterAdvancement),
//     unique action preservation, and specialActions deduplication. Critical
//     behavioral coverage — keep despite structural nature.
//
// Refactored:
//   - Replaced ~390 lines of duplicated mocks with a single import of the
//     shared CharSpecialActions.modalMocks.jsx module. Reduces mock
//     maintenance burden and ensures consistency across test files.

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';

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

// CharSpecialActions.featureChoice.test.jsx (open modal, skip/close, handler calls,
// runtime state for defensive_tactics/hunter_prey/damage_bonus). No behavioral gap.

describe('CharSpecialActions - useEffect cancelled guard', () => {
  it('does not set fightingStylesMap if component unmounts during async load', async () => {
    let resolveLoad;
    const loadPromise = new Promise((resolve) => { resolveLoad = resolve; });

    vi.mocked((await import('../../services/ui/dataLoader.js')).loadFightingStyles).mockReturnValue(loadPromise);

    const { unmount } = render(<CharSpecialActions playerStats={createPlayerStats()} campaignName="test" />);

    // Unmount immediately before the promise resolves
    unmount();

    // Resolve the promise - should not throw
    await act(async () => {
      resolveLoad([{ name: 'Great Weapon Fighting', description: '' }]);
    });

    // If we got here without an error, the cancelled guard works
    expect(screen.queryByText('Great Weapon Fighting')).not.toBeInTheDocument();
  });
});

// consolidated from 2 near-identical tests into 1 parameterized test. Both tested
// the same pattern: executeHandler returns popup → no creature-selection-modal.
// Parameterized data table covers both automation types.

describe('CharSpecialActions - Modal handler early return (no creature selection)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { name: 'Bolstering Performance', automation: { type: 'temp_hp_buff' }, popupName: 'Bolstering Performance' },
    { name: 'Encouraging Song', automation: { type: 'heroic_inspiration_buff' }, popupName: 'Encouraging Song' },
  ])('does not render creature selection when $name handler returns popup', async ({ name, automation, popupName }) => {
    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: { name: popupName, description: 'Action completed.' },
    });

    const playerStats = createPlayerStats({
      specialActions: [
        { name, description: `${name} description.`, automation },
      ],
    });

    render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

    await act(async () => {
      fireEvent.click(screen.getAllByText(new RegExp(name))[0]);
    });

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    });
  });
});

// coverage in the test suite. Tests cover all four action lists (actions,
// bonusActions, reactions, characterAdvancement), unique action preservation,
// and specialActions deduplication. Critical behavioral coverage.

describe('CharSpecialActions - Action filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithDuplicates(specialActions, actionsList, actionsKey) {
    const playerStats = createPlayerStats({
      specialActions,
      [actionsKey]: actionsList,
    });
    render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
    return playerStats;
  }

  it('filters out actions that appear in actions list', async () => {
    renderWithDuplicates(
      [{ name: 'Attack', description: 'Make an attack.' }],
      [{ name: 'Attack', description: 'Make an attack.' }],
      'actions'
    );

    await waitFor(() => {
      expect(screen.queryByText(/Attack/)).not.toBeInTheDocument();
    });
  });

  it('filters out actions that appear in bonusActions list', async () => {
    renderWithDuplicates(
      [{ name: 'Second Wind', description: 'Regain hit points.' }],
      [{ name: 'Second Wind', description: 'Regain hit points.' }],
      'bonusActions'
    );

    await waitFor(() => {
      expect(screen.queryByText(/Second Wind/)).not.toBeInTheDocument();
    });
  });

  it('filters out actions that appear in reactions list', async () => {
    renderWithDuplicates(
      [{ name: 'Reaction Attack', description: 'Attack as a reaction.' }],
      [{ name: 'Reaction Attack', description: 'Attack as a reaction.' }],
      'reactions'
    );

    await waitFor(() => {
      expect(screen.queryByText(/Reaction Attack/)).not.toBeInTheDocument();
    });
  });

  it('filters out actions that appear in characterAdvancement list', async () => {
    renderWithDuplicates(
      [{ name: 'Feat', description: 'Take a feat.' }],
      [{ name: 'Feat', description: 'Take a feat.' }],
      'characterAdvancement'
    );

    await waitFor(() => {
      expect(screen.queryByText(/Feat/)).not.toBeInTheDocument();
    });
  });

  it('does not filter specialActions that have unique names across all lists', async () => {
    const playerStats = createPlayerStats({
      specialActions: [
        { name: 'Unique Action', description: 'A unique action.' },
      ],
      actions: [{ name: 'Attack', description: 'Make an attack.' }],
      bonusActions: [{ name: 'Second Wind', description: 'Regain hit points.' }],
      reactions: [{ name: 'Reaction Attack', description: 'Attack as a reaction.' }],
      characterAdvancement: [{ name: 'Feat', description: 'Take a feat.' }],
    });
    render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

    await waitFor(() => {
      expect(screen.getByText(/Unique Action/)).toBeInTheDocument();
    });
  });

  it('deduplicates specialActions with the same name, keeping the last occurrence', async () => {
    const playerStats = createPlayerStats({
      specialActions: [
        { name: 'Attack', description: 'First definition.' },
        { name: 'Attack', description: 'Second definition.' },
      ],
    });
    render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

    await waitFor(() => {
      const instances = screen.getAllByText(/Attack/);
      expect(instances).toHaveLength(1);
    });
  });
});

// CharSpecialActions.combatHandlers.test.jsx (renders modal, clicks No, asserts
// modal closed). Same behavior tested with same assertions. No behavioral gap.
