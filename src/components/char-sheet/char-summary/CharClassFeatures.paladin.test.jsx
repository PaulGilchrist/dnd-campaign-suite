// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as gloriousDefense from '../../../services/automation/handlers/class-cleric-paladin/gloriousDefenseHandler.js';
import * as auraOfProtection from '../../../services/combat/auras/auraOfProtection.js';
import * as dataLoader from '../../../services/ui/dataLoader.js';

// Paladin Features are reached through the CharClassFeatures registry entry
// point (class name 'Paladin' → PaladinFeatures, region testid 'char-class-paladin').
// Registry routing itself is covered by CharClassFeatures.test.jsx.

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/class-cleric-paladin/gloriousDefenseHandler.js', () => ({
  hasGloriousDefenseActive: vi.fn(() => false),
  handle: vi.fn(),
}));

vi.mock('../../../services/combat/auras/auraOfProtection.js', () => ({
  getAuraRangeFromStats: vi.fn(() => 10),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([])),
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

vi.mock('../../common/popup.jsx', () => ({
  default: function MockPopup({ html, onClickOrKeyDown }) {
    return (
      <div onClick={onClickOrKeyDown}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
      </div>
    );
  },
}));

// Mirrors the shape classRules.getPaladinFeatures returns in the real service.
const defaultPaladinFeatures = { maxChannelDivinity: 2, auraRange: null, extraAttacks: 1 };

function mockPaladinFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({ ...defaultPaladinFeatures, ...overrides });
}

function paladinClass(overrides = {}) {
  return { name: 'Paladin', major: {}, subclass: {}, class_levels: [], fightingStyles: [], ...overrides };
}

function paladinStats(level, overrides = {}) {
  return {
    name: 'Test Paladin',
    level,
    rules: '5e',
    proficiency: 2,
    class: paladinClass(),
    abilities: [
      { name: 'Strength', bonus: 1 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 1 },
      { name: 'Intelligence', bonus: 1 },
      { name: 'Wisdom', bonus: 1 },
      { name: 'Charisma', bonus: 3 },
    ],
    automation: {},
    ...overrides,
  };
}

function renderPaladin(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName="test-campaign" />);
  return screen.getByTestId('char-class-paladin');
}

describe('PaladinFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPaladinFeatures();
    runtimeState.useRuntimeValue.mockReturnValue(undefined);
  });

  describe('aura of protection', () => {
    it.each([
      { cha: 3, expected: '+3' },
      // Pinned display quirk: the modifier is interpolated after a literal '+',
      // so a negative Charisma renders "+-1" rather than "-1".
      { cha: -1, expected: '+-1' },
    ])('renders the locked line with CHA $cha at level 5 and never consults the range service', ({ cha, expected }) => {
      const stats = paladinStats(5, { abilities: [{ name: 'Charisma', bonus: cha }] });
      const section = renderPaladin(stats);
      expect(section.textContent).toContain(`Aura of Protection: ${expected} to saves (locked)`);
      expect(auraOfProtection.getAuraRangeFromStats).not.toHaveBeenCalled();
    });

    it('unlocks at level 6 and takes its range from the aura service', () => {
      auraOfProtection.getAuraRangeFromStats.mockReturnValue(10);
      const stats = paladinStats(6, { abilities: [{ name: 'Charisma', bonus: 3 }] });
      const section = renderPaladin(stats);
      expect(section.textContent).toContain('Aura of Protection: +3 to saves (10 ft.)');
      expect(auraOfProtection.getAuraRangeFromStats).toHaveBeenCalledWith(stats);
    });

    it.each([
      ['Charisma missing from abilities', [{ name: 'Strength', bonus: 3 }]],
      ['abilities is null', null],
    ])('omits the line when %s', (_label, abilities) => {
      const section = renderPaladin(paladinStats(7, { abilities }));
      expect(section.textContent).not.toContain('Aura of Protection');
    });
  });

  describe('aura range row', () => {
    it.each([10, 0])('renders the numeric range %i straight from the service (guard is !== null, so 0 renders)', (range) => {
      mockPaladinFeatures({ auraRange: range });
      const section = renderPaladin(paladinStats(7));
      expect(section.textContent).toContain(`Aura Range: ${range}`);
    });

    it('omits the row when auraRange is null', () => {
      const section = renderPaladin(paladinStats(7));
      expect(section.textContent).not.toContain('Aura Range');
    });
  });

  describe('channel divinity charges', () => {
    it.each([
      [3, 3],
      [0, 0],
    ])('maxChannelDivinity %p renders %i/%i charges', (input, max) => {
      mockPaladinFeatures({ maxChannelDivinity: input });
      renderPaladin(paladinStats(2));
      expect(screen.getByTestId('tracked-resource-channelDivinityCharges'))
        .toHaveTextContent(`Channel Divinity Charges: ${max}/${max}`);
    });
  });

  describe('extra attacks', () => {
    it.each([
      [2, 'Extra Attacks: 2'],
      [0, 'Extra Attacks: 0'],
    ])('extraAttacks %p renders as "%s"', (extraAttacks, expected) => {
      mockPaladinFeatures({ extraAttacks });
      const section = renderPaladin(paladinStats(5));
      expect(section.textContent).toContain(expected);
    });
  });

  describe('fighting styles', () => {
    it('lists selected styles as clickable text', () => {
      const section = renderPaladin(paladinStats(2, {
        class: paladinClass({ fightingStyles: ['Defense', 'Great Weapon Fighting'] }),
      }));
      expect(section.textContent).toContain('Fighting Styles: Defense, Great Weapon Fighting');
      expect(screen.getByText('Defense')).toHaveClass('clickable');
      expect(screen.getByText('Great Weapon Fighting')).toHaveClass('clickable');
    });

    it('omits the whole row when fightingStyles is null', () => {
      const section = renderPaladin(paladinStats(2, { class: paladinClass({ fightingStyles: null }) }));
      expect(section.textContent).not.toContain('Fighting Styles');
    });

    it('renders the header with no styles and no N/A for an empty array', () => {
      const section = renderPaladin(paladinStats(2));
      expect(section.textContent).toContain('Fighting Styles:');
      expect(section.textContent).not.toContain('N/A');
    });
  });

  describe('fighting style badge popup', () => {
    const FIGHTING_STYLE_CATALOG = [
      { name: 'Defense', description: 'DEFENSE_POPUP_DESC' },
      { name: 'Dueling', description: 'DUELING_POPUP_DESC' },
    ];

    async function renderLoadedStyles(styles) {
      dataLoader.loadFightingStyles.mockResolvedValue(FIGHTING_STYLE_CATALOG);
      renderPaladin(paladinStats(2, { class: paladinClass({ fightingStyles: styles }) }));
      await act(async () => {});
    }

    it('clicking a style badge opens its popup and clicking the popup dismisses it', async () => {
      await renderLoadedStyles(['Defense', 'Dueling']);

      fireEvent.click(screen.getByText('Defense'));

      expect(screen.getByText('DEFENSE_POPUP_DESC')).toBeInTheDocument();
      expect(screen.getByText('click to dismiss')).toBeInTheDocument();
      // Only the clicked style pops up — the other badge must not leak content.
      expect(screen.queryByText('DUELING_POPUP_DESC')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('DEFENSE_POPUP_DESC'));
      expect(screen.queryByText('DEFENSE_POPUP_DESC')).not.toBeInTheDocument();
      expect(screen.queryByText('click to dismiss')).not.toBeInTheDocument();
    });

    it('ignores badge clicks when the style catalog has no entry for it', async () => {
      await renderLoadedStyles(['Interception']);

      fireEvent.click(screen.getByText('Interception'));

      expect(screen.queryByText('click to dismiss')).not.toBeInTheDocument();
    });
  });

  describe('lay on hands pool', () => {
    it.each([
      [1, 5],
      [20, 100],
    ])('tracks a pool of 5 × level (level %i → max %i)', (level, max) => {
      renderPaladin(paladinStats(level));
      expect(screen.getByTestId('tracked-resource-layOnHandsPool'))
        .toHaveTextContent(`Lay On Hands Pool: ${max}/${max}`);
    });
  });

  describe('glorious defense', () => {
    it('omits the tracked resource when the handler reports inactive', () => {
      const stats = paladinStats(5);
      const section = renderPaladin(stats);
      expect(gloriousDefense.hasGloriousDefenseActive).toHaveBeenCalledWith(stats);
      expect(screen.queryByTestId('tracked-resource-gloriousDefenseUses')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Glorious Defense');
    });

    it.each([
      { cha: 5, max: 5 },
      { cha: -2, max: 1 },
      { cha: undefined, max: 1, abilities: [] },
    ])('max uses is the Charisma modifier with a floor of 1 (CHA %p → %i)', ({ cha, max, abilities }) => {
      gloriousDefense.hasGloriousDefenseActive.mockReturnValue(true);
      const stats = paladinStats(5, { abilities: abilities ?? [{ name: 'Charisma', bonus: cha }] });
      renderPaladin(stats);
      expect(gloriousDefense.hasGloriousDefenseActive).toHaveBeenCalledWith(stats);
      expect(screen.getByTestId('tracked-resource-gloriousDefenseUses'))
        .toHaveTextContent(`Glorious Defense Uses: ${max}/${max}`);
    });
  });

  describe('active buff badges', () => {
    const badgeTests = [
      { key: 'holyNimbusActive', name: 'Holy Nimbus' },
      { key: 'livingLegendActive', name: 'Living Legend' },
      { key: 'peerlessAthleteActive', name: 'Peerless Athlete' },
      { key: 'elderChampionActive', name: 'Elder Champion' },
      { key: 'avengingAngelActive', name: 'Avenging Angel' },
    ];

    function runtimeFlags(valueFor) {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        const badge = badgeTests.find(b => b.key === key);
        return badge ? valueFor(badge) : undefined;
      });
    }

    it.each(badgeTests)('shows only the $name badge when only $key is true', ({ key, name }) => {
      runtimeFlags(badge => (badge.key === key ? true : false));
      const section = renderPaladin(paladinStats(1));
      expect(section.textContent).toContain(name);
      badgeTests.filter(b => b.key !== key).forEach(({ name: other }) => {
        expect(section.textContent).not.toContain(other);
      });
    });

    it('renders truthy non-true buff flags for every badge except Peerless Athlete (strict === true)', () => {
      runtimeFlags(() => 1);
      const section = renderPaladin(paladinStats(1));
      badgeTests.forEach(({ key, name }) => {
        if (key === 'peerlessAthleteActive') {
          expect(section.textContent).not.toContain(name);
        } else {
          expect(section.textContent).toContain(name);
        }
      });
    });

    it('hides every badge when no buff flags are set', () => {
      runtimeFlags(() => undefined);
      const section = renderPaladin(paladinStats(1));
      badgeTests.forEach(({ name }) => expect(section.textContent).not.toContain(name));
    });
  });
});
