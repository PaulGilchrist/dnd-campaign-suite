// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as dataLoader from '../../../services/ui/dataLoader.js';

// Ranger Features are reached through the CharClassFeatures registry entry
// point (class name 'Ranger' → RangerFeatures).

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
// (level - 1 / find(cl => cl.level === level)), so fixtures exercise real
// class-level data rather than index-juggling inside each test.
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
    it('tracks Dread Ambush at level 3+ with max from Wisdom modifier', () => {
      renderRanger(rangerStats(3));
      expect(screen.getByTestId('tracked-resource-dreadambushUses'))
        .toHaveTextContent('Dread Ambush: 3/3');
    });

    it('omits Dread Ambush below level 3', () => {
      const section = renderRanger(rangerStats(2));
      expect(screen.queryByTestId('tracked-resource-dreadambushUses')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Dread Ambush');
    });

    it('tracks Favored Enemy at level 2+ with max from the matching class level', () => {
      renderRanger(rangerStats(2, { favored_enemy: 4 }));
      expect(screen.getByTestId('tracked-resource-favoredEnemyUses'))
        .toHaveTextContent('Favored Enemy: 4/4');
    });

    it('floors Favored Enemy max to 1 when no class level entry matches the level', () => {
      // favored_enemy is defined only on the level-2 entry; at level 5 the
      // level-matching find misses and the feature still tracks 1 use.
      const stats = rangerStats(5);
      stats.class.class_levels[1] = { level: 2, favored_enemy: 4 };
      renderRanger(stats);
      expect(screen.getByTestId('tracked-resource-favoredEnemyUses'))
        .toHaveTextContent('Favored Enemy: 1/1');
    });

    it('omits Favored Enemy below level 2', () => {
      const section = renderRanger(rangerStats(1));
      expect(screen.queryByTestId('tracked-resource-favoredEnemyUses')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Favored Enemy');
    });

    it('tracks Tireless at level 10+ with max from Wisdom modifier', () => {
      renderRanger(rangerStats(10));
      expect(screen.getByTestId('tracked-resource-tirelessUses'))
        .toHaveTextContent('Tireless: 3/3');
    });

    it('omits Tireless below level 10', () => {
      const section = renderRanger(rangerStats(9));
      expect(screen.queryByTestId('tracked-resource-tirelessUses')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Tireless');
    });

    it("tracks Nature's Veil at level 14+ with max from Wisdom modifier", () => {
      renderRanger(rangerStats(14));
      expect(screen.getByTestId('tracked-resource-naturesVeilUses'))
        .toHaveTextContent("Nature's Veil: 3/3");
    });

    it("omits Nature's Veil below level 14", () => {
      const section = renderRanger(rangerStats(13));
      expect(screen.queryByTestId('tracked-resource-naturesVeilUses')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain("Nature's Veil");
    });

    it.each([
      ['dreadambushUses', 'Dread Ambush', 3],
      ['tirelessUses', 'Tireless', 10],
      ['naturesVeilUses', "Nature's Veil", 14],
    ])('floors %s max to 1 with a non-positive Wisdom modifier', (resourceKey, label, level) => {
      renderRanger(rangerStats(level, {}, { abilities: [{ name: 'Wisdom', bonus: -1 }] }));
      expect(screen.getByTestId(`tracked-resource-${resourceKey}`))
        .toHaveTextContent(`${label}: 1/1`);
    });
  });

  describe('expertise', () => {
    it('renders the expertise list at level > 2', () => {
      const section = renderRanger(rangerStats(5, {}, { expertise: ['Stealth', 'Survival'] }));
      expect(section.textContent).toContain('Expertise: Stealth, Survival');
    });

    it.each([
      ['level is 2', rangerStats(2, {}, { expertise: ['Stealth'] })],
      ['expertise array is empty', rangerStats(5, {}, { expertise: [] })],
      ['expertise is undefined', rangerStats(5)],
    ])('omits expertise when %s', (_label, stats) => {
      const section = renderRanger(stats);
      expect(section.textContent).not.toContain('Expertise');
    });
  });

  describe('fighting styles', () => {
    it('lists all selected styles as clickable entries at level > 1', () => {
      const section = renderRanger(
        rangerStats(2, {}, { fightingStyles: ['Defense', 'Two-Weapon Fighting'] })
      );
      expect(section.textContent).toContain('Fighting Styles: Defense, Two-Weapon Fighting');
      expect(screen.getByText('Defense')).toHaveClass('clickable');
      expect(screen.getByText('Two-Weapon Fighting')).toHaveClass('clickable');
    });

    it.each([
      ['level is 1', rangerStats(1, {}, { fightingStyles: ['Defense'] })],
      ['fightingStyles is null', rangerStats(2, {}, { fightingStyles: null })],
      ['fightingStyles is missing', buildPlayerStats({
        level: 2,
        class: { name: 'Ranger', major: {}, subclass: {}, class_levels: [{ level: 2 }] },
      })],
    ])('omits the fighting styles row when %s', (_label, stats) => {
      const section = renderRanger(stats);
      expect(section.textContent).not.toContain('Fighting Styles');
    });
  });

  describe('fighting style popup', () => {
    async function renderWithStyleCatalog(styles) {
      dataLoader.loadFightingStyles.mockResolvedValue(FIGHTING_STYLE_CATALOG);
      const section = renderRanger(rangerStats(2, {}, { fightingStyles: styles }));
      await act(async () => {});
      return section;
    }

    it('clicking a style opens a popup with its loaded description', async () => {
      await renderWithStyleCatalog(['Defense', 'Two-Weapon Fighting']);

      fireEvent.click(screen.getByText('Defense'));

      expect(screen.getByText('DEFENSE_POPUP_DESC')).toBeInTheDocument();
      expect(screen.getByText('click to dismiss')).toBeInTheDocument();
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
      [{ extraAttacks: 0 }, '0'],
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
      const badge = screen.getByText(choice);
      expect(badge).toHaveClass('automation-badge');
      expect(section).toContainElement(badge);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('omits both choice badges when the choices are %s', (_label, choiceValue) => {
      mockRuntime({ defensiveTactics: choiceValue, huntersPrey: choiceValue });
      const section = renderRanger(rangerStats(5));
      expect(section.textContent).not.toContain('Evasion');
      expect(section.textContent).not.toContain('Marked Target');
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
    });
  });
});
