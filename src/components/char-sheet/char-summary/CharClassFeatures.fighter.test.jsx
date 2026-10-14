// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as dataLoader from '../../../services/ui/dataLoader.js';

// Fighter Features are reached through the CharClassFeatures registry entry
// point (class name 'Fighter' → FighterFeatures).

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

  describe('render gate (class level lookup)', () => {
    it.each([
      ['class_levels is null', null],
      ['class_levels is empty', []],
      ['class_levels is shorter than the character level', [{ level: 1 }, { level: 2 }]],
    ])('renders nothing when %s', (_label, class_levels) => {
      const stats = buildPlayerStats({
        level: 5,
        class: { name: 'Fighter', major: {}, subclass: {}, class_levels, fightingStyles: [] },
      });
      render(<CharClassFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.queryByTestId('char-class-fighter')).not.toBeInTheDocument();
    });
  });

  describe('action surge', () => {
    it('5e tracks max from class_specific.action_surges', () => {
      renderFighter(fighterStats(2, { class_specific: { action_surges: 2 } }));
      expect(screen.getByTestId('tracked-resource-actionSurgeUses'))
        .toHaveTextContent('Action Surge Uses: 2/2');
    });

    it('5e tracks 0 uses when classLevel lacks class_specific data', () => {
      renderFighter(fighterStats(2));
      expect(screen.getByTestId('tracked-resource-actionSurgeUses'))
        .toHaveTextContent('Action Surge Uses: 0/0');
    });

    it.each([
      [1, 0],
      [2, 1],
      [16, 1],
      [17, 2],
      [20, 2],
    ])('2024 derives max from level: level %i → %i use(s)', (level, max) => {
      renderFighter(fighterStats(level, {}, { rules: '2024' }));
      expect(screen.getByTestId('tracked-resource-actionSurgeUses'))
        .toHaveTextContent(`Action Surge Uses: ${max}/${max}`);
    });
  });

  describe('extra attacks', () => {
    it('reads Extra Attacks from classLevel.extra_attacks', () => {
      const section = renderFighter(fighterStats(5, { extra_attacks: 2 }));
      expect(section.textContent).toContain('Extra Attacks: 2');
    });

    it('defaults Extra Attacks to 0 when classLevel lacks extra_attacks', () => {
      const section = renderFighter(fighterStats(3));
      expect(section.textContent).toContain('Extra Attacks: 0');
    });
  });

  describe('second wind', () => {
    it('tracks uses from classLevel.second_wind', () => {
      renderFighter(fighterStats(1, { second_wind: 1 }));
      expect(screen.getByTestId('tracked-resource-secondWindUses'))
        .toHaveTextContent('Second Wind: 1/1');
    });

    it('tracks 0 uses when classLevel lacks second_wind', () => {
      renderFighter(fighterStats(1));
      expect(screen.getByTestId('tracked-resource-secondWindUses'))
        .toHaveTextContent('Second Wind: 0/0');
    });
  });

  describe('weapon mastery', () => {
    it('renders the mastery value and opens the mastery modal when clicked', () => {
      const section = renderFighter(fighterStats(5, { weapon_mastery: 'Piercing' }));
      expect(section.textContent).toContain('Weapon Mastery: Piercing');
      expect(screen.queryByText('WeaponKindMasteryModal')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Piercing'));

      expect(screen.getByText('WeaponKindMasteryModal')).toBeInTheDocument();
      expect(runtimeState.getRuntimeValue)
        .toHaveBeenCalledWith('Test Fighter', '_Weapon_Kind_Mastery_chosenWeapons', 'test-campaign');
    });
  });

  describe('energy system', () => {
    const energy = { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 6 };

    it('renders energy dice when energy.required_major matches the major name', () => {
      const section = renderFighter(
        fighterStats(5, { energy }, { major: { name: 'Psi Warrior' } })
      );
      expect(screen.getByTestId('tracked-resource-psionicEnergy'))
        .toHaveTextContent('Energy Dice: 4/4');
      expect(section.textContent).toContain('Energy Die Type: d6');
    });

    it('matches the major name via the subclass fallback', () => {
      renderFighter(
        fighterStats(5, { energy }, { subclass: { name: 'Psi Warrior' } })
      );
      expect(screen.getByTestId('tracked-resource-psionicEnergy')).toBeInTheDocument();
    });

    it.each([
      ['required_major names a different major', energy, { major: { name: 'Battle Master' } }],
      ['no major or subclass is set', energy, {}],
    ])('omits energy dice when %s', (_label, classLevelEnergy, majorOptions) => {
      const section = renderFighter(fighterStats(5, { energy: classLevelEnergy }, majorOptions));
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
    it('lists all selected styles as clickable badges', () => {
      const section = renderFighter(
        fighterStats(2, {}, { fightingStyles: ['Defense', 'Great Weapon Fighting'] })
      );
      expect(section.textContent).toContain('Fighting Styles: Defense, Great Weapon Fighting');
      expect(screen.getByText('Defense')).toHaveClass('clickable');
      expect(screen.getByText('Great Weapon Fighting')).toHaveClass('clickable');
    });

    it('renders N/A when fightingStyles is null', () => {
      const stats = buildPlayerStats({
        level: 1,
        class: { name: 'Fighter', major: {}, subclass: {}, class_levels: [{ level: 1 }], fightingStyles: null },
      });
      const section = renderFighter(stats);
      expect(section.textContent).toContain('Fighting Styles: N/A');
    });

    it('renders no styles and no N/A when fightingStyles is an empty array', () => {
      const section = renderFighter(fighterStats(1));
      expect(section.textContent).toContain('Fighting Styles:');
      expect(section.textContent).not.toContain('N/A');
    });
  });

  describe('fighting style badge popup (bug-CLA-005 collateral)', () => {
    async function renderLoadedBadges(styles) {
      dataLoader.loadFightingStyles.mockResolvedValue(FIGHTING_STYLE_CATALOG);
      const section = renderFighter(fighterStats(18, {}, { fightingStyles: styles }));
      await act(async () => {});
      return section;
    }

    it('clicking a style badge opens a popup with its loaded description', async () => {
      await renderLoadedBadges(['Unarmed Fighting', 'Interception']);

      fireEvent.click(screen.getByText('Unarmed Fighting'));

      expect(screen.getByText('UNARMED_POPUP_DESC')).toBeInTheDocument();
      expect(screen.getByText('click to dismiss')).toBeInTheDocument();
      // Only the clicked style pops up — the other badge must not leak content.
      expect(screen.queryByText('INTERCEPTION_POPUP_DESC')).not.toBeInTheDocument();
    });

    it('clicking the open popup dismisses it', async () => {
      await renderLoadedBadges(['Unarmed Fighting', 'Interception']);

      fireEvent.click(screen.getByText('Interception'));
      expect(screen.getByText('INTERCEPTION_POPUP_DESC')).toBeInTheDocument();

      fireEvent.click(screen.getByText('INTERCEPTION_POPUP_DESC'));
      expect(screen.queryByText('INTERCEPTION_POPUP_DESC')).not.toBeInTheDocument();
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

    it('tracks Battle Master dice max from _trackedResources.superiorityDice', () => {
      renderFighter(fighterStats(10, {}, {
        ...battleMaster,
        trackedResources: { superiorityDice: { max: 5 } },
      }));
      expect(screen.getByTestId('tracked-resource-superiorityDice'))
        .toHaveTextContent('Superiority Dice: 5/5');
    });

    it.each([
      [3, 8],
      [9, 8],
      [10, 10],
      [17, 10],
      [18, 12],
      [20, 12],
    ])('Battle Master at level %i shows die type d%i', (level, dieType) => {
      const section = renderFighter(fighterStats(level, {}, battleMaster));
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
