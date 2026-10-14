// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../services/ui/dataLoader.js';

// Fighter Features are reached through the CharClassFeatures registry entry
// point (class name 'Fighter' → FighterFeatures). The entry point's own
// lifecycle (modal seeding/close, dodge badge) is owned by
// CharClassFeatures.test.jsx — this file owns fighter-specific values,
// gates, and the fighting-style popup.

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => null),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(),
}));

// Mock with a resourceKey-scoped testid so assertions can verify a specific
// tracked resource's computed max, not just that "some" number rendered.
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

vi.mock('../modals/WeaponKindMasteryModal.jsx', () => ({
  default: function MockWeaponKindMasteryModal() {
    return <div>WeaponKindMasteryModal</div>;
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
    name: 'Test Fighter',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Fighter',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Strength', bonus: 3 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 2 },
      { name: 'Intelligence', bonus: 0 },
      { name: 'Wisdom', bonus: 1 },
      { name: 'Charisma', bonus: 1 },
    ],
    automation: {},
    ...overrides,
  };
}

// Builds a fighter fixture whose class_levels array has `level` entries, with
// classLevelData placed at the index the component actually reads
// (level - 1), so fixtures exercise real class-level data rather than
// index-juggling spread acrobatics inside each test.
function fighterStats(level, classLevelData = {}, options = {}) {
  const { rules = '5e', major = {}, subclass = {}, fightingStyles = [], trackedResources } = options;
  const class_levels = Array.from({ length: level }, (_, i) =>
    i === level - 1 ? { level, ...classLevelData } : { level: i + 1 }
  );
  return buildPlayerStats({
    level,
    rules,
    ...(trackedResources ? { _trackedResources: trackedResources } : {}),
    class: { name: 'Fighter', major, subclass, class_levels, fightingStyles },
  });
}

const FIGHTING_STYLE_CATALOG = [
  { name: 'Unarmed Fighting', description: 'UNARMED_POPUP_DESC' },
  { name: 'Interception', description: 'INTERCEPTION_POPUP_DESC' },
];

function renderFighter(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName="test-campaign" />);
  return screen.getByTestId('char-class-fighter');
}

describe('FighterFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.useRuntimeValue.mockImplementation(() => undefined);
    dataLoader.loadFightingStyles.mockResolvedValue([]);
  });

  it.each([
    ['class_levels is missing', null],
    ['class_levels is shorter than the character level', [{ level: 1 }, { level: 2 }]],
  ])('renders nothing when %s', (_label, class_levels) => {
    const stats = buildPlayerStats({
      level: 5,
      class: { name: 'Fighter', major: {}, subclass: {}, class_levels, fightingStyles: [] },
    });
    render(<CharClassFeatures playerStats={stats} campaignName="test-campaign" />);
    expect(screen.queryByTestId('char-class-fighter')).not.toBeInTheDocument();
  });

  // Action surge: 5e reads class_specific.action_surges, 2024 derives from
  // level (thresholds at 2 and 17). One table pins both rulesets' branches.
  it.each([
    ['5e reads class_specific.action_surges', '5e', 2, { class_specific: { action_surges: 2 } }, 2],
    ['5e falls back to 0 when class_specific is absent', '5e', 2, {}, 0],
    ['2024 level below 2 has no surge', '2024', 1, {}, 0],
    ['2024 level 2 grants one surge', '2024', 2, {}, 1],
    ['2024 level 17 grants two surges', '2024', 17, {}, 2],
  ])('%s', (_label, rules, level, classLevelData, max) => {
    renderFighter(fighterStats(level, classLevelData, { rules }));
    expect(screen.getByTestId('tracked-resource-actionSurgeUses'))
      .toHaveTextContent(`Action Surge Uses: ${max}/${max}`);
  });

  it.each([
    ['reads Extra Attacks from classLevel.extra_attacks', 5, { extra_attacks: 2 }, 2],
    ['defaults Extra Attacks to 0 when absent', 3, {}, 0],
  ])('%s', (_label, level, classLevelData, expected) => {
    const section = renderFighter(fighterStats(level, classLevelData));
    expect(section.textContent).toContain(`Extra Attacks: ${expected}`);
  });

  it.each([
    ['tracks uses from classLevel.second_wind', 1, { second_wind: 1 }, 1],
    ['tracks 0 uses when classLevel lacks second_wind', 1, {}, 0],
  ])('second wind: %s', (_label, level, classLevelData, uses) => {
    renderFighter(fighterStats(level, classLevelData));
    expect(screen.getByTestId('tracked-resource-secondWindUses'))
      .toHaveTextContent(`Second Wind: ${uses}/${uses}`);
  });

  it('renders the mastery value and opens the mastery modal when clicked', () => {
    const section = renderFighter(fighterStats(5, { weapon_mastery: 'Piercing' }));
    expect(section.textContent).toContain('Weapon Mastery: Piercing');
    expect(screen.queryByText('WeaponKindMasteryModal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Piercing'));

    expect(screen.getByText('WeaponKindMasteryModal')).toBeInTheDocument();
  });

  describe('energy system', () => {
    const energy = { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 6 };

    it.each([
      ['major', { major: { name: 'Psi Warrior' } }],
      ['subclass fallback', { subclass: { name: 'Psi Warrior' } }],
    ])('renders energy dice when required_major matches the %s name', (_label, majorOptions) => {
      const section = renderFighter(fighterStats(5, { energy }, majorOptions));
      expect(screen.getByTestId('tracked-resource-psionicEnergy'))
        .toHaveTextContent('Energy Dice: 4/4');
      expect(section.textContent).toContain('Energy Die Type: d6');
    });

    it.each([
      ['required_major names a different major', { major: { name: 'Battle Master' } }],
      ['no major or subclass is set', {}],
    ])('omits energy dice when %s', (_label, majorOptions) => {
      const section = renderFighter(fighterStats(5, { energy }, majorOptions));
      expect(screen.queryByTestId('tracked-resource-psionicEnergy')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Energy Die Type');
    });

    it('omits energy dice when classLevel has no energy', () => {
      const section = renderFighter(fighterStats(5, {}, { major: { name: 'Psi Warrior' } }));
      expect(screen.queryByTestId('tracked-resource-psionicEnergy')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Energy');
    });
  });

  describe('fighting styles', () => {
    // The empty-array case pins that only a null fightingStyles renders the
    // "N/A" placeholder — an empty list must not become one.
    it.each([
      ['two styles as a comma list', ['Defense', 'Great Weapon Fighting'], 'Defense, Great Weapon Fighting'],
      ['null styles as N/A', null, 'N/A'],
      ['an empty list renders no styles and no N/A', [], ''],
    ])('renders %s', (_label, styles, expected) => {
      const section = renderFighter(fighterStats(2, {}, { fightingStyles: styles }));
      expect(section.textContent).toContain(`Fighting Styles: ${expected}`);
      if (expected !== 'N/A') {
        expect(section.textContent).not.toContain('N/A');
      }
    });
  });

  describe('fighting style badge popup (bug-CLA-005 collateral)', () => {
    it('opens the clicked style\'s description and dismisses on popup click', async () => {
      dataLoader.loadFightingStyles.mockResolvedValue(FIGHTING_STYLE_CATALOG);
      renderFighter(fighterStats(18, {}, { fightingStyles: ['Unarmed Fighting', 'Interception'] }));
      await act(async () => {});

      fireEvent.click(screen.getByText('Unarmed Fighting'));

      expect(screen.getByText('UNARMED_POPUP_DESC')).toBeInTheDocument();
      expect(screen.getByText('click to dismiss')).toBeInTheDocument();
      // Only the clicked style pops up — the other badge must not leak content.
      expect(screen.queryByText('INTERCEPTION_POPUP_DESC')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('UNARMED_POPUP_DESC'));

      expect(screen.queryByText('UNARMED_POPUP_DESC')).not.toBeInTheDocument();
      expect(screen.queryByText('click to dismiss')).not.toBeInTheDocument();
    });

    it('ignores badge clicks when the style catalog has no entry for it', async () => {
      dataLoader.loadFightingStyles.mockResolvedValue([{ name: 'Defense', description: 'DEFENSE_DESC' }]);
      renderFighter(fighterStats(18, {}, { fightingStyles: ['Unarmed Fighting'] }));
      await act(async () => {});

      fireEvent.click(screen.getByText('Unarmed Fighting'));

      expect(screen.queryByText('click to dismiss')).not.toBeInTheDocument();
    });
  });

  describe('superiority dice', () => {
    const battleMaster = { major: { name: 'Battle Master' } };

    // One table pins Battle Master die-type tier boundaries (d8 → d10 at 10,
    // d12 at 18) alongside the max wired from _trackedResources.
    it.each([
      [3, 8, 4],
      [10, 10, 5],
      [18, 12, 7],
    ])('Battle Master at level %i shows d%i with tracked max', (level, dieType, max) => {
      const section = renderFighter(fighterStats(level, {}, {
        ...battleMaster,
        trackedResources: { superiorityDice: { max } },
      }));
      expect(screen.getByTestId('tracked-resource-superiorityDice'))
        .toHaveTextContent(`Superiority Dice: ${max}/${max}`);
      expect(section.textContent).toContain(`Superiority Die: d${dieType}`);
    });

    it('grants d6 superiority dice to any fighter with the Superior Technique style', () => {
      const section = renderFighter(fighterStats(1, {}, {
        fightingStyles: ['Superior Technique'],
        trackedResources: { superiorityDice: { max: 1 } },
      }));
      expect(screen.getByTestId('tracked-resource-superiorityDice'))
        .toHaveTextContent('Superiority Dice: 1/1');
      expect(section.textContent).toContain('Superiority Die: d6');
    });

    it('omits superiority dice for a plain fighter', () => {
      const section = renderFighter(fighterStats(5, {}, { fightingStyles: ['Defense'] }));
      expect(screen.queryByTestId('tracked-resource-superiorityDice')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Superiority');
    });
  });
});
