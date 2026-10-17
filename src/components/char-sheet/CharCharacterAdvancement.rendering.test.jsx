// @maintained-by-ai
// Rendering lane for CharCharacterAdvancement (siblings: .options.test.jsx owns
// automation.options display/highlight/click, .coverage.test.jsx owns the live
// sanitizeHtml wiring — do not duplicate those here. CharSheet.* tests mock this
// component entirely; featureCategories.test.js files anchor the ignore-list data,
// so component-level filter APPLICATION is unique to this file):
//   - section header + missing/null characterAdvancement (no feature rows)
//   - name/description display, paired and in order
//   - duplicate-name grouping with "* N" suffix, first-entry data wins
//   - featuresToIgnore filtering per ruleset, with cross-ruleset discriminating
//     probes (Darkvision/Feat/Fighter Subclass are ignored in exactly one list)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const { mockGetRuntimeValue, mockSetRuntimeValue } = vi.hoisted(() => ({
  mockGetRuntimeValue: vi.fn(),
  mockSetRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: mockGetRuntimeValue,
  setRuntimeValue: mockSetRuntimeValue,
}));

// Rendered content of the section, in DOM order: header, one entry per
// grouped feature, then the trailing half-line spacer (filtered out).
function sectionText(container) {
  return [...container.querySelectorAll('.char-character-advancement > div')]
    .map((d) => d.textContent)
    .filter(Boolean);
}

describe('CharCharacterAdvancement - Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  afterEach(cleanup);

  it.each([
    { label: 'an empty array', playerStats: { name: 'Test Character', characterAdvancement: [] } },
    { label: 'null', playerStats: { name: 'Test Character', characterAdvancement: null } },
    { label: 'undefined', playerStats: { name: 'Test Character', characterAdvancement: undefined } },
    { label: 'missing', playerStats: { name: 'Test Character' } },
  ])('renders the header and no feature rows when characterAdvancement is %s', ({ playerStats }) => {
    const { container } = render(
      <CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />
    );
    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
    expect(sectionText(container)).toEqual(['Character Advancement']);
  });

  it('renders features even when playerStats has no name property', () => {
    render(
      <CharCharacterAdvancement
        playerStats={{ characterAdvancement: [{ name: 'Feature', description: 'Desc' }] }}
        campaignName="test-campaign"
      />
    );
    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
    expect(screen.getByText('Feature:')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  it('renders each feature as a bold label paired with its description, in input order', () => {
    const playerStats = {
      name: 'Test Character',
      characterAdvancement: [
        { name: 'Darkvision', description: 'See in darkness' },
        { name: 'Second', description: 'Attacks twice' },
        { name: 'Third', description: '3' },
      ],
    };
    const { container } = render(
      <CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />
    );
    expect(sectionText(container)).toEqual([
      'Character Advancement',
      'Darkvision: See in darkness',
      'Second: Attacks twice',
      'Third: 3',
    ]);
  });

  it('merges duplicate feature names under one "* N" label, keeps only the first description, and leaves singletons unsuffixed', () => {
    const playerStats = {
      name: 'Test Character',
      rules: '5e',
      characterAdvancement: [
        { name: 'Mystic Arcanum', description: 'First description' },
        { name: 'Darkvision', description: 'See in darkness' },
        { name: 'Mystic Arcanum', description: 'Second description' },
      ],
    };
    render(
      <CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />
    );
    expect(screen.getByText('Mystic Arcanum * 2:')).toBeInTheDocument();
    expect(screen.queryByText('Mystic Arcanum:')).not.toBeInTheDocument();
    expect(screen.getByText('Darkvision:')).toBeInTheDocument();
    expect(screen.getByText('First description')).toBeInTheDocument();
    expect(screen.queryByText('Second description')).not.toBeInTheDocument();
  });

  const alwaysHidden = ['Spellcasting', 'Extra Attack']; // in BOTH ignore lists
  // Darkvision/Feat/Fighter Subclass are in categories2024.featuresToIgnore only —
  // using the wrong list would leak them (2024) or wrongly hide them (5e).
  const only2024Hidden = ['Darkvision', 'Feat', 'Fighter Subclass'];

  it.each([
    { label: "'5e'", rules: '5e', hidden: alwaysHidden },
    { label: 'missing (defaults to 5e)', rules: undefined, hidden: alwaysHidden },
    { label: 'null (defaults to 5e)', rules: null, hidden: alwaysHidden },
    { label: "'2024'", rules: '2024', hidden: [...alwaysHidden, ...only2024Hidden] },
  ])('applies the featuresToIgnore list for ruleset %s', ({ rules, hidden }) => {
    const featureNames = ['Valid Feature', ...alwaysHidden, ...only2024Hidden];
    const playerStats = {
      name: 'Test Character',
      rules,
      characterAdvancement: featureNames.map((name) => ({ name, description: `${name} desc` })),
    };
    render(
      <CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />
    );
    expect(screen.getByText('Valid Feature:')).toBeInTheDocument();
    for (const name of featureNames) {
      if (hidden.includes(name)) {
        expect(screen.queryByText(`${name}:`)).not.toBeInTheDocument();
      } else {
        expect(screen.getByText(`${name}:`)).toBeInTheDocument();
      }
    }
  });
});
