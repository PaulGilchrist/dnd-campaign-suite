// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Barbarian lane of the CharClassFeatures registry entry point.
// Owns: ruleset-conditional scaling display (extra attacks, rage count/
// damage, weapon mastery), rage/reckless/aspect/rage-of-the-wilds badges,
// Warrior of the Gods pool + max-dice table, and the mastery-span click
// opening the modal. Registry dispatch, dodge badge, non-array activeBuffs
// robustness, and post-click modal seeding/close are owned by the core
// CharClassFeatures.test.jsx — do not duplicate them here.

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => null),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
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

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Barbarian',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Barbarian',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Strength', bonus: 2 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 2 },
      { name: 'Intelligence', bonus: 0 },
      { name: 'Wisdom', bonus: 1 },
      { name: 'Charisma', bonus: 1 },
    ],
    automation: {
      specialActions: [],
      bonusActions: [],
      passives: [],
      reactions: [],
    },
    ...overrides,
  };
}

// Builds a class_levels array of `level` entries with extra fields placed at
// the index the component actually reads (level - 1), so fixtures exercise the
// "classLevel exists but field missing" fallbacks rather than undefined-slip.
function barbarianStats(level, classLevelData = {}, overrides = {}) {
  const class_levels = Array.from({ length: level }, (_, i) =>
    i === level - 1 ? { level, ...classLevelData } : { level: i + 1 }
  );
  return buildPlayerStats({
    level,
    class: { name: 'Barbarian', major: {}, subclass: {}, class_levels, fightingStyles: [] },
    ...overrides,
  });
}

function mockRuntime({ buffs = [], aspectChoice = undefined } = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return buffs;
    if (key === 'aspectOfTheWildsOption') return aspectChoice;
    return undefined;
  });
}

function renderBarbarian(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName="test-campaign" />);
  return screen.getByTestId('char-class-barbarian');
}

describe('BarbarianFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime();
  });

  describe('5e ruleset', () => {
    it.each([
      [4, 0],
      [5, 1],
    ])('at level %i shows Extra Attacks: %i (extra attack unlocks at 5)', (level, expected) => {
      const section = renderBarbarian(barbarianStats(level));
      expect(section.textContent).toContain(`Extra Attacks: ${expected}`);
    });

    it('reads Rage Points max and Rage Damage Bonus from class_specific', () => {
      const section = renderBarbarian(barbarianStats(2, {
        class_specific: { rage_count: 2, rage_damage_bonus: 3 },
      }));
      expect(screen.getByTestId('tracked-resource-ragePoints')).toHaveTextContent('Rage Points: 2/2');
      expect(section.textContent).toContain('Rage Damage Bonus: 3');
    });

    it('forces Weapon Mastery to N/A even when class_level data provides one', () => {
      const section = renderBarbarian(barbarianStats(5, { weapon_mastery: 'Slashing' }));
      expect(section.textContent).toContain('Weapon Mastery: N/A');
    });
  });

  describe('2024 ruleset', () => {
    it('reads extra attacks, rages, rage damage and mastery from classLevel', () => {
      const section = renderBarbarian(barbarianStats(3, {
        extra_attacks: 2,
        rages: 3,
        rage_damage: 4,
        weapon_mastery: 'Greatweapon Mastery',
      }, { rules: '2024' }));
      expect(section.textContent).toContain('Extra Attacks: 2');
      expect(screen.getByTestId('tracked-resource-ragePoints')).toHaveTextContent('Rage Points: 3/3');
      expect(section.textContent).toContain('Rage Damage Bonus: 4');
      expect(section.textContent).toContain('Weapon Mastery: Greatweapon Mastery');
    });

    it('defaults every scaling value to 0 / N/A when classLevel lacks the fields', () => {
      const section = renderBarbarian(barbarianStats(3, {}, { rules: '2024' }));
      expect(section.textContent).toContain('Extra Attacks: 0');
      expect(screen.getByTestId('tracked-resource-ragePoints')).toHaveTextContent('Rage Points: 0/0');
      expect(section.textContent).toContain('Rage Damage Bonus: 0');
      expect(section.textContent).toContain('Weapon Mastery: N/A');
    });
  });

  describe('buff-driven badges', () => {
    it('highlights rage damage and shows the automation badge while the Rage buff is active', () => {
      mockRuntime({ buffs: [{ name: 'Rage' }] });
      const section = renderBarbarian(barbarianStats(2, { class_specific: { rage_damage_bonus: 2 } }));
      const buffed = section.querySelector('.stat--buffed');
      expect(buffed).not.toBeNull();
      expect(buffed.textContent).toBe('2');
      expect(screen.getByText('BPS Resist, STR Adv, +2 dmg')).toHaveClass('automation-badge');
    });

    it('renders no buff styling and no badges when no qualifying buff or feature is present', () => {
      mockRuntime({ buffs: [{ name: 'Some Other Buff' }] });
      const section = renderBarbarian(barbarianStats(2, { class_specific: { rage_damage_bonus: 2 } }));
      expect(section.querySelector('.stat--buffed')).toBeNull();
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
      expect(section.textContent).not.toContain('BPS Resist');
    });

    it('shows the Reckless Attack badge only for the advantage_attacks_advantage_against effect', () => {
      mockRuntime({ buffs: [{ effect: 'advantage_attacks_advantage_against' }] });
      const section = renderBarbarian(buildPlayerStats());
      expect(screen.getByText(/Reckless Attack/)).toHaveClass('automation-badge');
      expect(section.textContent).toContain('attacks against you have Advantage');
    });
  });

  describe('aspect of the wilds', () => {
    it.each([
      ['badge when the feature exists and a choice is set', [{ type: 'animal_aspect' }], 'Flying Speed', true],
      ['no badge when no choice is set', [{ type: 'animal_aspect' }], undefined, false],
      ['no badge when the feature is missing', [], 'Swimming Speed', false],
    ])('renders %s', (_label, specialActions, aspectChoice, expected) => {
      mockRuntime({ aspectChoice });
      renderBarbarian(buildPlayerStats({ automation: { specialActions } }));
      if (expected) {
        expect(screen.getByText('Aspect of the Wilds: Flying Speed')).toHaveClass('automation-badge');
      } else {
        expect(screen.queryByText(/Aspect of the Wilds/)).not.toBeInTheDocument();
      }
    });
  });

  describe('rage of the wilds', () => {
    it.each([
      ['buff with an optionName shows its option', [{ name: 'Rage of the Wilds', optionName: 'Gale Force' }], true],
      ['buff without an optionName renders nothing', [{ name: 'Rage of the Wilds' }], false],
      ['no buff renders nothing', [], false],
    ])('%s', (_label, buffs, expected) => {
      mockRuntime({ buffs });
      renderBarbarian(buildPlayerStats());
      if (expected) {
        expect(screen.getByText('Rage of the Wilds: Gale Force')).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Rage of the Wilds/)).not.toBeInTheDocument();
      }
    });
  });

  describe('warrior of the gods', () => {
    it.each([
      [5, 4],
      [6, 5],
      [11, 5],
      [12, 6],
      [16, 6],
      [17, 7],
    ])('at level %i sets the pool max to %i (boundary steps)', (level, expected) => {
      renderBarbarian(barbarianStats(level, {}, { bonusActions: [{ name: 'Warrior of the Gods' }] }));
      expect(screen.getByTestId('tracked-resource-warriorofthegodsPool'))
        .toHaveTextContent(`Warrior of the Gods: ${expected}/${expected}`);
    });

    it('omits the pool when the feature is not a bonus action', () => {
      renderBarbarian(barbarianStats(5));
      expect(screen.queryByTestId('tracked-resource-warriorofthegodsPool')).not.toBeInTheDocument();
    });
  });

  describe('weapon mastery interaction', () => {
    it('opens the weapon mastery modal when the mastery value is clicked', () => {
      const section = renderBarbarian(barbarianStats(3, {}, { rules: '2024' }));
      expect(screen.queryByText('WeaponKindMasteryModal')).not.toBeInTheDocument();
      fireEvent.click(section.querySelector('.clickable'));
      expect(screen.getByText('WeaponKindMasteryModal')).toBeInTheDocument();
    });
  });
});
