// @maintained-by-ai
// Root composition-seam lane for CharSpecialActions:
//   - section header + row composition (names, descriptions, unnamed fallback)
//   - fresh mount renders NO modals (open-routing → modals.test.jsx,
//     dismiss/inertness → modalOnClose.* quartet, confirm-stamping → handlers.test.jsx)
//   - fighting-style async composition (unmount guard → uncovered.edge-cases)
//   - ruleset featuresToIgnore + 'Level 1 Spell [Instance' row exclusion
//   - SP-103 Shape-Shift runtime row visibility
// Cross-list action filtering lives in uncovered.edge-cases.test.jsx;
// per-row clickability/dispatch lanes live in the row-specific siblings.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';

// The shared mock's loadFightingStyles map already contains all four styles
// the component checks for — no local dataLoader override needed.

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
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Purge the shared runtime store so campaign-level state (e.g.
  // targetEffects) never bleeds between tests.
  for (const key of Object.keys(mockRuntimeStore)) delete mockRuntimeStore[key];
});

describe('CharSpecialActions - section composition', () => {
  it('renders the Special Actions header with named rows showing name and description', () => {
    render(
      <CharSpecialActions playerStats={createPlayerStats({
        specialActions: [
          { name: 'Second Wind', description: 'You can use a bonus action to regain hit points.' },
          { name: 'Action Surge', description: 'Take an extra action.' },
        ],
      })} campaignName="test" />
    );
    expect(screen.getByText('Special Actions')).toBeInTheDocument();
    // Rows render their name as the exact "<Name>:" label plus description.
    expect(screen.getByText('Second Wind:')).toBeInTheDocument();
    expect(screen.getByText('You can use a bonus action to regain hit points.')).toBeInTheDocument();
    expect(screen.getByText('Action Surge:')).toBeInTheDocument();
    expect(screen.getByText('Take an extra action.')).toBeInTheDocument();
  });

  it('renders an unnamed special action via its description fallback', () => {
    render(
      <CharSpecialActions playerStats={createPlayerStats({
        specialActions: [{ description: 'An unnamed special action' }],
      })} campaignName="test" />
    );
    expect(screen.getByText('An unnamed special action')).toBeInTheDocument();
  });

  it('mounts the modal host with every modal absent', async () => {
    render(<CharSpecialActions playerStats={createPlayerStats()} campaignName="test" />);
    await waitFor(() => {
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });
    for (const testId of [
      'teleport-modal',
      'signature-spells-modal',
      'stride-of-the-elements-modal',
      'combat-superiority-modal',
      'creature-selection-modal',
      'multi-resistance-modal',
      'portent-modal',
    ]) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  });
});

describe('CharSpecialActions - fighting style composition', () => {
  it.each([
    { style: 'Great Weapon Fighting', desc: /treat any 1 or 2/ },
    { style: 'Interception', desc: /reduce the damage by 1d10/ },
    { style: 'Protection', desc: /impose disadvantage/ },
    { style: 'Two-Weapon Fighting', desc: /add your ability modifier/ },
  ])('appends $style from the loaded fighting-styles map', async ({ style, desc }) => {
    render(
      <CharSpecialActions playerStats={createPlayerStats({
        class: { fightingStyles: [style] },
      })} campaignName="test" />
    );
    await waitFor(() => {
      expect(screen.getByText(`${style}:`)).toBeInTheDocument();
    });
    expect(screen.getByText(desc)).toBeInTheDocument();
  });

  it('does not duplicate or shadow a style already in specialActions', async () => {
    render(
      <CharSpecialActions playerStats={createPlayerStats({
        specialActions: [{ name: 'Great Weapon Fighting', description: 'Already added.' }],
        class: { fightingStyles: ['Great Weapon Fighting'] },
      })} campaignName="test" />
    );
    await waitFor(() => {
      expect(screen.getAllByText('Great Weapon Fighting:')).toHaveLength(1);
    });
    // The stored entry survives — the loader map does not overwrite it.
    expect(screen.getByText('Already added.')).toBeInTheDocument();
    expect(screen.queryByText(/treat any 1 or 2/)).not.toBeInTheDocument();
  });
});

describe('CharSpecialActions - ruleset filtering', () => {
  it.each([
    {
      rules: '5e',
      ignored: ['Spellcasting', 'Extra Attack'],
      kept: ['Bardic Inspiration', 'Test Feature'],
    },
    {
      rules: '2024',
      ignored: ['Spellcasting', 'Feat', 'Fighting Style'],
      kept: ['Test Feature'],
    },
  ])('for $rules ruleset drops featuresToIgnore and keeps the rest', ({ rules, ignored, kept }) => {
    render(
      <CharSpecialActions playerStats={createPlayerStats({
        specialActions: [
          ...ignored.map(name => ({ name, description: `${name} description.` })),
          ...kept.map(name => ({ name, description: `${name} description.` })),
        ],
        rules,
      })} campaignName="test" />
    );
    for (const name of ignored) {
      expect(screen.queryByText(`${name}:`)).not.toBeInTheDocument();
    }
    for (const name of kept) {
      expect(screen.getByText(`${name}:`)).toBeInTheDocument();
    }
  });

  it('excludes Level 1 Spell [Instance rows while keeping companion rows', () => {
    render(
      <CharSpecialActions playerStats={createPlayerStats({
        specialActions: [
          { name: 'Level 1 Spell [Instance 42]', description: 'Expended slot.' },
          { name: 'Magic Item', description: 'A wondrous item.' },
        ],
      })} campaignName="test" />
    );
    expect(screen.queryByText('Level 1 Spell [Instance 42]:')).not.toBeInTheDocument();
    expect(screen.getByText('Magic Item:')).toBeInTheDocument();
  });
});

describe('CharSpecialActions - Shape-Shift runtime row (SP-103)', () => {
  it.each([
    { label: 'object target', target: 'TestCharacter', shown: true },
    { label: 'array target', target: ['TestCharacter'], shown: true },
    { label: 'another creature as target', target: 'OtherGuy', shown: false },
    { label: 'a different effect on this creature', target: 'TestCharacter', effect: 'sanctuary', shown: false },
  ])('shows the row only for a shapechange targetEffect on this character ($label)', ({ target, effect = 'shapechange', shown }) => {
    mockRuntimeStore.targetEffects = [{ target, effect }];
    render(<CharSpecialActions playerStats={createPlayerStats()} campaignName="test" />);
    if (shown) {
      expect(screen.getByText('Shape-Shift:')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Shape-Shift:')).not.toBeInTheDocument();
    }
  });
});
