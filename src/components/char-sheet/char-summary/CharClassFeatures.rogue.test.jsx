// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as classFeatures from '../../../services/character/classFeatures.js';

// Rogue Features are reached through the CharClassFeatures registry entry
// point (class name 'Rogue' → RogueFeatures). Registry dispatch itself is
// owned by CharClassFeatures.test.jsx — this file owns RogueFeatures'
// rendering rules: expertise row, sneak attack line, energy-dice gating
// (required_major vs major/subclass name) and the Supreme Sneak badge.

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({})),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
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

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Rogue',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Rogue',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Dexterity', bonus: 3 },
    ],
    automation: {},
    ...overrides,
  };
}

// Builds a rogue fixture whose class_levels array has `level` entries, with
// classLevelData placed at the index the component actually reads
// (level - 1), so fixtures exercise real class-level data rather than
// index-juggling inside each test.
function rogueStats(level, classLevelData = {}, options = {}) {
  const { major = {}, subclass = {} } = options;
  const class_levels = Array.from({ length: level }, (_, i) =>
    i === level - 1 ? { level, ...classLevelData } : { level: i + 1 }
  );
  return buildPlayerStats({
    level,
    class: { name: 'Rogue', major, subclass, class_levels, fightingStyles: [] },
  });
}

function thiefStats(level = 9) {
  return rogueStats(level, {}, { major: { name: 'Thief' } });
}

function mockRuntime({ stealthAttackCost = undefined } = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'stealthAttackCost') return stealthAttackCost;
    return undefined;
  });
}

function renderRogue(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName="test-campaign" />);
  return screen.getByTestId('char-class-rogue');
}

const SWASHBUCKLER_ENERGY = { required_major: 'Swashbuckler', energy_die_num: 4, energy_die_type: 6 };

describe('RogueFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish baselines every test so mockReturnValue set in one test
    // can never leak into another (clearAllMocks does not reset returns).
    classFeatures.getClassFeatures.mockReturnValue({
      sneakAttack: { dice_count: 3, dice_value: 6 },
    });
    mockRuntime();
  });

  describe('expertise', () => {
    it('renders the joined expertise list from getClassFeatures', () => {
      classFeatures.getClassFeatures.mockReturnValue({
        expertise: ['Stealth', 'Perception', "Thieves' Tools"],
      });
      const section = renderRogue(rogueStats(5));
      expect(section.textContent).toContain("Expertise: Stealth, Perception, Thieves' Tools");
    });

    it.each([
      ['the expertise array is empty', []],
      ['expertise is undefined', undefined],
    ])('omits the expertise row when %s', (_label, expertise) => {
      classFeatures.getClassFeatures.mockReturnValue({ expertise });
      const section = renderRogue(rogueStats(5));
      expect(section.textContent).not.toContain('Expertise');
    });
  });

  describe('sneak attack damage', () => {
    // { dice_count: 0, dice_value: 0 } renders identically to a missing
    // sneakAttack (both hit the `|| 0` fallback), so only the missing
    // shape is exercised as the +0d0 case.
    it.each([
      [{ sneakAttack: { dice_count: 3, dice_value: 6 } }, '+3d6'],
      [{ sneakAttack: { dice_count: 5, dice_value: 8 } }, '+5d8'],
      [{}, '+0d0'],
    ])('renders sneak attack %o as %s', (features, expected) => {
      classFeatures.getClassFeatures.mockReturnValue(features);
      const section = renderRogue(rogueStats(1));
      expect(section.textContent).toContain(`Sneak Attack Damage: ${expected}`);
    });
  });

  describe('energy dice (subclass psionic energy)', () => {
    it.each([
      ['the major name', { major: { name: 'Swashbuckler' } }],
      ['the subclass name fallback', { subclass: { name: 'Swashbuckler' } }],
    ])('tracks Energy Dice with max from energy_die_num when required_major matches %s', (_label, options) => {
      const section = renderRogue(rogueStats(5, { energy: SWASHBUCKLER_ENERGY }, options));
      expect(screen.getByTestId('tracked-resource-psionicEnergy'))
        .toHaveTextContent('Energy Dice: 4/4');
      expect(section.textContent).toContain('Energy Die Type: d6');
    });

    it.each([
      ['required_major does not match the major',
        rogueStats(5, { energy: SWASHBUCKLER_ENERGY }, { major: { name: 'Assassin' } })],
      ['the class level entry has no energy field',
        rogueStats(5, {}, { major: { name: 'Swashbuckler' } })],
      ['class_levels is null',
        buildPlayerStats({
          level: 5,
          class: { name: 'Rogue', major: { name: 'Swashbuckler' }, subclass: {}, class_levels: null, fightingStyles: [] },
        })],
    ])('omits energy dice when %s', (_label, stats) => {
      const section = renderRogue(stats);
      expect(screen.queryByTestId('tracked-resource-psionicEnergy')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Energy Dice');
      expect(section.textContent).not.toContain('Energy Die Type');
    });
  });

  describe('supreme sneak badge', () => {
    it.each([
      ['the major name', thiefStats(9)],
      ['the subclass name fallback', rogueStats(9, {}, { subclass: { name: 'Thief' } })],
    ])('renders the inactive availability badge for a level 9 Thief via %s', (_label, stats) => {
      const section = renderRogue(stats);
      const badge = screen.getByTitle(/Supreme Sneak/);
      expect(section).toContainElement(badge);
      expect(badge).toHaveTextContent('Supreme Sneak');
      expect(badge.getAttribute('title')).toContain('Available at Rogue level 9');
      expect(badge).not.toHaveClass('automation-badge--active');
    });

    // The inactive side (undefined, 0, null costs) is the same branch as
    // the availability case above; only the positive toggle is unique here.
    it('shows the active tooltip and active styling when stealthAttackCost is positive', () => {
      mockRuntime({ stealthAttackCost: 1 });
      renderRogue(thiefStats(9));
      const badge = screen.getByTitle(/Supreme Sneak/);
      expect(badge.getAttribute('title')).toContain('Stealth Attack active');
      expect(badge).toHaveClass('automation-badge--active');
    });

    it.each([
      ['a Thief below level 9', thiefStats(8)],
      ['an Assassin at level 20', rogueStats(20, {}, { major: { name: 'Assassin' } })],
    ])('omits the badge for %s even while stealth attack is active', (_label, stats) => {
      mockRuntime({ stealthAttackCost: 1 });
      const section = renderRogue(stats);
      expect(screen.queryByTitle(/Supreme Sneak/)).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Supreme Sneak');
    });
  });
});
