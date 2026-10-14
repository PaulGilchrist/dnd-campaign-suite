// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as dataLoader from '../../../services/ui/dataLoader.js';

// Ranger Features are reached through the CharClassFeatures registry entry
// point (class name 'Ranger' → RangerFeatures). Registry dispatch itself is
// owned by CharClassFeatures.test.jsx — this file owns ranger content only.

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({})),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(),
}));

// Mock with a resourceKey-scoped testid so assertions can verify a specific
// tracked resource's computed max, not just that "some" label rendered.
vi.mock('./TrackedResourceInput.jsx', () => ({
  default: function MockTrackedResourceInput({ label, getMax, resourceKey }) {
    const max = getMax ? getMax() : 0;
    return (
      <div data-testid={`tracked-resource-${resourceKey}`}>
        <b>{label}:</b> <span>{max}/{max}</span>
      </div>
    );
  },
}));

vi.mock('../../common/popup.jsx', () => ({
  default: function MockPopup({ html, onClickOrKeyDown }) {
    return (
      <div onClick={onClickOrKeyDown}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
      </div>
    );
  },
}));

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Ranger',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Ranger',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Wisdom', bonus: 3 },
    ],
    automation: {},
    ...overrides,
  };
}

// Builds a ranger fixture whose class_levels array has `level` entries, with
// classLevelData placed at the index the component actually reads
// (find(cl => cl.level === level)), so fixtures exercise real class-level
// data rather than index-juggling inside each test.
function rangerStats(level, classLevelData = {}, options = {}) {
  const { fightingStyles = [], expertise, abilities } = options;
  const class_levels = Array.from({ length: level }, (_, i) =>
    i === level - 1 ? { level, ...classLevelData } : { level: i + 1 }
  );
  return buildPlayerStats({
    level,
    ...(expertise !== undefined ? { expertise } : {}),
    ...(abilities ? { abilities } : {}),
    class: { name: 'Ranger', major: {}, subclass: {}, class_levels, fightingStyles },
  });
}

function mockRuntime({ defensiveTactics = undefined, huntersPrey = undefined } = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === '_Defensive_Tactics_choice') return defensiveTactics;
    if (key === "_Hunter's_Prey_choice") return huntersPrey;
    return undefined;
  });
}

function renderRanger(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName="test-campaign" />);
  return screen.getByTestId('char-class-ranger');
}

const WIS_GATED_RESOURCES = [
  ['dreadambushUses', 'Dread Ambush'],
  ['tirelessUses', 'Tireless'],
  ['naturesVeilUses', "Nature's Veil"],
];

const FIGHTING_STYLE_CATALOG = [
  { name: 'Defense', description: 'DEFENSE_POPUP_DESC' },
  { name: 'Two-Weapon Fighting', description: 'TWO_WEAPON_POPUP_DESC' },
];

describe('RangerFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish baselines every test so mockReturnValue set in one test
    // can never leak into another (clearAllMocks does not reset returns).
    classFeatures.getClassFeatures.mockReturnValue({ extraAttacks: 0 });
    dataLoader.loadFightingStyles.mockResolvedValue([]);
    mockRuntime();
  });

  describe('level-gated tracked resources', () => {
    // One case per gate (Favored 2, Dread Ambush 3, Tireless 10, Nature's
    // Veil 14): each level pins the exact set of tracked resources present,
    // covering both sides of every gate and proving gates act independently.
    it.each([
      [1, []],
      [2, ['favoredEnemyUses']],
      [3, ['favoredEnemyUses', 'dreadambushUses']],
      [10, ['favoredEnemyUses', 'dreadambushUses', 'tirelessUses']],
      [14, ['favoredEnemyUses', 'dreadambushUses', 'tirelessUses', 'naturesVeilUses']],
    ])('at level %i renders exactly these tracked resources: %j', (level, presentKeys) => {
      const section = renderRanger(rangerStats(level));
      const allResources = [['favoredEnemyUses', 'Favored Enemy'], ...WIS_GATED_RESOURCES];
      for (const [resourceKey, label] of allResources) {
        if (presentKeys.includes(resourceKey)) {
          expect(screen.getByTestId(`tracked-resource-${resourceKey}`))
            .toHaveTextContent(label);
        } else {
          expect(screen.queryByTestId(`tracked-resource-${resourceKey}`)).not.toBeInTheDocument();
          expect(section.textContent).not.toContain(label);
        }
      }
    });

    it.each([
      [3, '3/3'],
      [-1, '1/1'],
    ])('computes Wisdom-gated maxes as max(1, WIS mod) for WIS modifier %i', (wisdom, expected) => {
      renderRanger(rangerStats(14, {}, { abilities: [{ name: 'Wisdom', bonus: wisdom }] }));
      for (const [resourceKey, label] of WIS_GATED_RESOURCES) {
        expect(screen.getByTestId(`tracked-resource-${resourceKey}`))
          .toHaveTextContent(`${label}: ${expected}`);
      }
    });

    it('reads Favored Enemy max from the class level entry matching the level', () => {
      renderRanger(rangerStats(2, { favored_enemy: 4 }));
      expect(screen.getByTestId('tracked-resource-favoredEnemyUses'))
        .toHaveTextContent('Favored Enemy: 4/4');
    });

    it('floors Favored Enemy max to 1 when no class level entry matches the level', () => {
      // favored_enemy lives only on the level-2 entry; at level 5 the
      // level-matching find misses and the feature still tracks 1 use.
      const stats = rangerStats(5);
      stats.class.class_levels[1] = { level: 2, favored_enemy: 4 };
      renderRanger(stats);
      expect(screen.getByTestId('tracked-resource-favoredEnemyUses'))
        .toHaveTextContent('Favored Enemy: 1/1');
    });
  });

  describe('expertise', () => {
    // Full branch matrix of the row condition: level > 2 && truthy && non-empty.
    it.each([
      ['shown at level > 2', rangerStats(5, {}, { expertise: ['Stealth', 'Survival'] }), 'Expertise: Stealth, Survival'],
      ['hidden at level 2', rangerStats(2, {}, { expertise: ['Stealth'] }), null],
      ['hidden when the array is empty', rangerStats(5, {}, { expertise: [] }), null],
      ['hidden when undefined', rangerStats(5), null],
    ])('%s', (_label, stats, expected) => {
      const section = renderRanger(stats);
      if (expected) {
        expect(section.textContent).toContain(expected);
      } else {
        expect(section.textContent).not.toContain('Expertise');
      }
    });
  });

  describe('fighting styles', () => {
    // Branch matrix of the row condition: fightingStyles truthy && level > 1.
    it.each([
      ['shown with clickable entries at level 2', rangerStats(2, {}, { fightingStyles: ['Defense', 'Two-Weapon Fighting'] }), true],
      ['hidden at level 1', rangerStats(1, {}, { fightingStyles: ['Defense'] }), false],
      ['hidden when fightingStyles is null', rangerStats(2, {}, { fightingStyles: null }), false],
      ['hidden when fightingStyles is absent from class', buildPlayerStats({
        level: 2,
        class: { name: 'Ranger', major: {}, subclass: {}, class_levels: [{ level: 2 }] },
      }), false],
    ])('%s', (_label, stats, shown) => {
      const section = renderRanger(stats);
      if (shown) {
        expect(section.textContent).toContain('Fighting Styles: Defense, Two-Weapon Fighting');
        expect(screen.getByText('Defense')).toHaveClass('clickable');
        expect(screen.getByText('Two-Weapon Fighting')).toHaveClass('clickable');
      } else {
        expect(section.textContent).not.toContain('Fighting Styles');
      }
    });
  });

  describe('fighting style popup', () => {
    async function renderWithStyleCatalog(styles) {
      dataLoader.loadFightingStyles.mockResolvedValue(FIGHTING_STYLE_CATALOG);
      const section = renderRanger(rangerStats(2, {}, { fightingStyles: styles }));
      await act(async () => {});
      return section;
    }

    it('clicking a style opens a popup with its name and loaded description', async () => {
      await renderWithStyleCatalog(['Defense', 'Two-Weapon Fighting']);

      fireEvent.click(screen.getByText('Defense'));

      const popup = screen.getByText('click to dismiss').parentElement;
      expect(popup).toHaveTextContent('DEFENSE_POPUP_DESC');
      expect(popup).toHaveTextContent('Defense');
      // Only the clicked style pops up — the other badge must not leak content.
      expect(screen.queryByText('TWO_WEAPON_POPUP_DESC')).not.toBeInTheDocument();
    });

    it('clicking the open popup dismisses it', async () => {
      await renderWithStyleCatalog(['Defense']);

      fireEvent.click(screen.getByText('Defense'));
      expect(screen.getByText('DEFENSE_POPUP_DESC')).toBeInTheDocument();

      fireEvent.click(screen.getByText('DEFENSE_POPUP_DESC'));
      expect(screen.queryByText('DEFENSE_POPUP_DESC')).not.toBeInTheDocument();
      expect(screen.queryByText('click to dismiss')).not.toBeInTheDocument();
    });

    it('ignores style clicks when the catalog has no entry for it', async () => {
      await renderWithStyleCatalog(['Archery']);

      fireEvent.click(screen.getByText('Archery'));

      expect(screen.queryByText('click to dismiss')).not.toBeInTheDocument();
    });
  });

  describe('extra attacks', () => {
    it.each([
      [{ extraAttacks: 2 }, '2'],
      [{}, '0'],
    ])('renders Extra Attacks from getClassFeatures (%s)', (features, expected) => {
      classFeatures.getClassFeatures.mockReturnValue(features);
      const section = renderRanger(rangerStats(5));
      expect(section.textContent).toContain(`Extra Attacks: ${expected}`);
    });
  });

  describe('feature choice badges', () => {
    it.each([
      ['Defensive Tactics', 'Evasion', { defensiveTactics: 'Evasion' }],
      ["Hunter's Prey", 'Marked Target', { huntersPrey: 'Marked Target' }],
    ])('renders the %s badge with its runtime choice', (_name, choice, runtime) => {
      mockRuntime(runtime);
      const section = renderRanger(rangerStats(5));
      expect(within(section).getByText(choice)).toHaveClass('automation-badge');
    });

    it('omits both choice badges when no runtime choice exists', () => {
      // mockRuntime baseline (undefined) covers the absent path; the badge
      // count is the real assertion — no stray automation badges render.
      const section = renderRanger(rangerStats(5));
      expect(section.textContent).not.toContain('Evasion');
      expect(section.textContent).not.toContain('Marked Target');
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
    });
  });
});
