// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Barbarian Features are reached through the CharClassFeatures registry entry
// point (class name 'Barbarian' → BarbarianFeatures).

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
      [1, 0],
      [4, 0],
      [5, 1],
      [20, 1],
    ])('at level %i shows Extra Attacks: %i (extra attack unlocks at 5)', (level, expected) => {
      const section = renderBarbarian(barbarianStats(level));
      expect(section.textContent).toContain(`Extra Attacks: ${expected}`);
    });

    it('tracks Rage Points with max from class_specific.rage_count', () => {
      renderBarbarian(barbarianStats(2, { class_specific: { rage_count: 2 } }));
      expect(screen.getByTestId('tracked-resource-ragePoints')).toHaveTextContent('Rage Points: 2/2');
    });

    it('renders Rage Damage Bonus from class_specific.rage_damage_bonus', () => {
      const section = renderBarbarian(barbarianStats(2, { class_specific: { rage_damage_bonus: 2 } }));
      expect(section.textContent).toContain('Rage Damage Bonus: 2');
    });

    it('shows Weapon Mastery as N/A even when class_level data provides one (no mastery in 5e)', () => {
      const section = renderBarbarian(barbarianStats(5, { weapon_mastery: 'Slashing' }));
      expect(section.textContent).toContain('Weapon Mastery: N/A');
    });
  });

  describe('2024 ruleset', () => {
    it('reads Extra Attacks from classLevel.extra_attacks', () => {
      const section = renderBarbarian(barbarianStats(3, { extra_attacks: 2 }, { rules: '2024' }));
      expect(section.textContent).toContain('Extra Attacks: 2');
    });

    it('defaults Extra Attacks to 0 when classLevel lacks extra_attacks', () => {
      const section = renderBarbarian(barbarianStats(3, {}, { rules: '2024' }));
      expect(section.textContent).toContain('Extra Attacks: 0');
    });

    it('reads Rage Points max from classLevel.rages and Rage Damage from classLevel.rage_damage', () => {
      const section = renderBarbarian(barbarianStats(3, { rages: 3, rage_damage: 3 }, { rules: '2024' }));
      expect(screen.getByTestId('tracked-resource-ragePoints')).toHaveTextContent('Rage Points: 3/3');
      expect(section.textContent).toContain('Rage Damage Bonus: 3');
    });

    it('reads Weapon Mastery from classLevel.weapon_mastery', () => {
      const section = renderBarbarian(barbarianStats(3, { weapon_mastery: 'Greatweapon Mastery' }, { rules: '2024' }));
      expect(section.textContent).toContain('Weapon Mastery: Greatweapon Mastery');
    });

    it('shows Weapon Mastery as N/A when classLevel lacks weapon_mastery', () => {
      const section = renderBarbarian(barbarianStats(3, {}, { rules: '2024' }));
      expect(section.textContent).toContain('Weapon Mastery: N/A');
    });
  });

  describe('rage active state', () => {
    it('highlights rage damage with buffed styling and shows automation badge when Rage buff is active', () => {
      mockRuntime({ buffs: [{ name: 'Rage' }] });
      const section = renderBarbarian(barbarianStats(2, { class_specific: { rage_damage_bonus: 2 } }));
      const buffed = section.querySelector('.stat--buffed');
      expect(buffed).not.toBeNull();
      expect(buffed.textContent).toBe('2');
      expect(screen.getByText('BPS Resist, STR Adv, +2 dmg')).toHaveClass('automation-badge');
    });

    it('omits buffed styling and automation badge when Rage buff is not active', () => {
      mockRuntime({ buffs: [{ name: 'Some Other Buff' }] });
      const section = renderBarbarian(barbarianStats(2, { class_specific: { rage_damage_bonus: 2 } }));
      expect(section.querySelector('.stat--buffed')).toBeNull();
      expect(section.textContent).not.toContain('BPS Resist');
    });
  });

  describe('reckless attack', () => {
    it('renders reckless attack badge when advantage_attacks_advantage_against buff is present', () => {
      mockRuntime({ buffs: [{ effect: 'advantage_attacks_advantage_against' }] });
      const section = renderBarbarian(buildPlayerStats());
      expect(screen.getByText(/Reckless Attack/)).toHaveClass('automation-badge');
      expect(section.textContent).toContain('attacks against you have Advantage');
    });

    it('omits reckless attack badge when no matching buff', () => {
      mockRuntime({ buffs: [{ name: 'Rage' }] });
      renderBarbarian(buildPlayerStats());
      expect(screen.queryByText(/Reckless Attack/)).not.toBeInTheDocument();
    });
  });

  describe('aspect of the wilds', () => {
    it('renders aspect badge when feature exists and choice is set', () => {
      mockRuntime({ aspectChoice: 'Flying Speed' });
      renderBarbarian(buildPlayerStats({
        automation: { specialActions: [{ type: 'animal_aspect' }] },
      }));
      expect(screen.getByText('Aspect of the Wilds: Flying Speed')).toBeInTheDocument();
    });

    it.each([
      ['no choice set', [{ type: 'animal_aspect' }], undefined],
      ['feature missing', [], 'Swimming Speed'],
    ])('omits aspect badge when %s', (_label, specialActions, aspectChoice) => {
      mockRuntime({ aspectChoice });
      renderBarbarian(buildPlayerStats({ automation: { specialActions } }));
      expect(screen.queryByText(/Aspect of the Wilds/)).not.toBeInTheDocument();
    });

    it('survives a non-array activeBuffs value without rendering rage badges', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) =>
        key === 'activeBuffs' ? undefined : undefined
      );
      const section = renderBarbarian(buildPlayerStats());
      expect(section.querySelector('.stat--buffed')).toBeNull();
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
    });
  });

  describe('rage of the wilds', () => {
    it('renders option badge when Rage of the Wilds buff carries an optionName', () => {
      mockRuntime({ buffs: [{ name: 'Rage of the Wilds', optionName: 'Gale Force' }] });
      renderBarbarian(buildPlayerStats());
      expect(screen.getByText('Rage of the Wilds: Gale Force')).toBeInTheDocument();
    });

    it('omits option badge when the buff has no optionName or is absent', () => {
      mockRuntime({ buffs: [{ name: 'Rage of the Wilds' }] });
      renderBarbarian(buildPlayerStats());
      expect(screen.queryByText(/Rage of the Wilds/)).not.toBeInTheDocument();
    });
  });

  describe('warrior of the gods', () => {
    it('renders tracked resource when the feature is in bonusActions', () => {
      renderBarbarian(buildPlayerStats({ bonusActions: [{ name: 'Warrior of the Gods' }] }));
      expect(screen.getByTestId('tracked-resource-warriorofthegodsPool')).toBeInTheDocument();
    });

    it('omits tracked resource when the feature is not in bonusActions', () => {
      renderBarbarian(buildPlayerStats({ bonusActions: [] }));
      expect(screen.queryByTestId('tracked-resource-warriorofthegodsPool')).not.toBeInTheDocument();
    });

    it.each([
      [1, 4],
      [3, 4],
      [5, 4],
      [6, 5],
      [11, 5],
      [12, 6],
      [16, 6],
      [17, 7],
      [20, 7],
    ])('at level %i sets Warrior of the Gods max dice to %i', (level, expected) => {
      renderBarbarian(buildPlayerStats({ level, bonusActions: [{ name: 'Warrior of the Gods' }] }));
      expect(screen.getByTestId('tracked-resource-warriorofthegodsPool'))
        .toHaveTextContent(`Warrior of the Gods: ${expected}/${expected}`);
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
