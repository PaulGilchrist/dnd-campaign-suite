// @maintained-by-ai 2026-11-26
/**
 * Monk lane of the CharClassFeatures registry entry point
 * (class name 'Monk' → MonkFeatures). Owns display of monk-specific
 * values and runtime badges; registry dispatch itself is pinned by
 * CharClassFeatures.test.jsx — do not duplicate it here. The component's
 * local monkExtraAttacks() does NOT route through services/character/
 * extraAttacks.js, so the table below is component-owned, not a service
 * derivation duplicate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

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

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';

// Mirrors the shape getClassFeatures returns for a monk (lv2 baseline).
const defaultMonkFeatures = {
  martialArtsDie: 4,
  unarmoredMovementIncrease: 0,
  maxFocusPoints: 5,
};

function mockMonkFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({ ...defaultMonkFeatures, ...overrides });
}

function mockRuntime({
  buffs = [],
  attunementActive = undefined,
  attunementElement = undefined,
  epitomeActive = undefined,
  epitomeType = undefined,
  destructiveActive = undefined,
} = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    switch (key) {
      case 'activeBuffs': return buffs;
      case 'elementalAttunementActive': return attunementActive;
      case 'elementalAttunementElement': return attunementElement;
      case 'elementalEpitomeActive': return epitomeActive;
      case 'epitomeResistanceType': return epitomeType;
      case 'destructiveStrideActive': return destructiveActive;
      default: return undefined;
    }
  });
}

function monkStats(level = 2, overrides = {}) {
  return {
    name: 'Test Monk',
    level,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Monk',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    automation: {},
    ...overrides,
  };
}

function renderMonk(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
  return screen.getByTestId('char-class-monk');
}

describe('MonkFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMonkFeatures();
    mockRuntime();
  });

  it('renders nothing below level 2 (Ki features unlock at level 2)', () => {
    render(<CharClassFeatures playerStats={monkStats(1)} campaignName={CAMPAIGN} />);
    expect(screen.queryByTestId('char-class-monk')).not.toBeInTheDocument();
  });

  describe('extra attacks', () => {
    // fix bug-5e-fighter-extra-attacks-second-wind-zeroed (census leg): the
    // 5e monk table carries no extra_attacks column — 5e grants a single
    // Extra Attack at level 5 (same branch at 5 and 20). The 2024 branch
    // reads class_levels[level - 1] exactly — never searches other entries.
    it.each([
      ['5e below level 5', '5e', 4, [{ level: 4 }], 0],
      ['5e at level 5', '5e', 5, [{ level: 5 }], 1],
      ['2024 reads class_levels[level - 1].extra_attacks', '2024', 5, [null, null, null, null, { level: 5, extra_attacks: 2 }], 2],
      ['2024 row without the column', '2024', 5, [null, null, null, null, { level: 5 }], 0],
      ['2024 never searches other entries', '2024', 10, [null, { level: 2, extra_attacks: 1 }], 0],
    ])('%s renders Extra Attacks: %i', (_label, rules, level, class_levels, expected) => {
      const stats = monkStats(level, {
        rules,
        class: { name: 'Monk', major: {}, subclass: {}, class_levels, fightingStyles: [] },
      });
      const section = renderMonk(stats);
      expect(section.textContent).toContain(`Extra Attacks: ${expected}`);
    });
  });

  // The mock renders getMax() output, so this pins the resourceKey wiring and
  // the `maxFocusPoints || 0` fallback in one render per case.
  it.each([
    ['the max from class features', 7, 'Focus Points: 7/7'],
    ['0 when class features omit it', undefined, 'Focus Points: 0/0'],
  ])('tracks Focus Points with %s', (_label, maxFocusPoints, expected) => {
    mockMonkFeatures({ maxFocusPoints });
    renderMonk(monkStats(2));
    expect(screen.getByTestId('tracked-resource-focusPoints')).toHaveTextContent(expected);
  });

  describe('focus save DC', () => {
    it.each([
      [3, 2, 13],
      [-1, 2, 9],
    ])('calculates Focus Save DC as 8 + WIS %i + proficiency %i = %i', (wisdomBonus, proficiency, expectedDC) => {
      const stats = monkStats(2, {
        abilities: [{ name: 'Wisdom', bonus: wisdomBonus }],
        proficiency,
      });
      const section = renderMonk(stats);
      expect(section.textContent).toContain(`Focus Save DC: ${expectedDC}`);
    });

    it('uses the Wisdom modifier, not another ability, for the focus save DC', () => {
      const stats = monkStats(2, {
        abilities: [
          { name: 'Strength', bonus: 5 },
          { name: 'Charisma', bonus: 4 },
          { name: 'Wisdom', bonus: 3 },
        ],
        proficiency: 2,
      });
      const section = renderMonk(stats);
      expect(section.textContent).toContain('Focus Save DC: 13');
      expect(section.textContent).not.toContain('Focus Save DC: 15');
      expect(section.textContent).not.toContain('Focus Save DC: 14');
    });
  });

  // Positive values and the `|| 0` fallbacks for the die/movement line.
  it.each([
    ['class-feature values', { martialArtsDie: 8, unarmoredMovementIncrease: 15 }, 'd8', '+15 ft.'],
    ['omitted values fall back to zero', { martialArtsDie: undefined, unarmoredMovementIncrease: undefined }, 'd0', '+0 ft.'],
  ])('renders martial arts die and unarmored movement from %s', (_label, features, expectedDie, expectedMove) => {
    mockMonkFeatures(features);
    const section = renderMonk(monkStats(2));
    expect(section.textContent).toContain(`Martial Arts Die: ${expectedDie}`);
    expect(section.textContent).toContain(`Unarmored Movement: ${expectedMove}`);
  });

  it.each([
    ['renders for the cloak_of_shadows effect', [{ effect: 'cloak_of_shadows' }], true],
    ['omits for unrelated buffs', [{ effect: 'some_other_effect' }], false],
  ])('cloak of shadows badge %s', (_label, buffs, shouldShow) => {
    mockRuntime({ buffs });
    const section = renderMonk(monkStats(2));
    if (shouldShow) {
      expect(section.textContent).toContain('Cloak of Shadows');
    } else {
      expect(section.textContent).not.toContain('Cloak of Shadows');
    }
  });

  // One gating matrix for the flag-driven badges in MonkElementalBadges:
  // each badge shows only when its own active flag is truthy, and the
  // epitome line names its stored type (or the "not chosen" fallback).
  describe('runtime badge gating', () => {
    it.each([
      ['attunement renders the element', { attunementActive: true, attunementElement: 'Fire' }, 'toContain', 'Elemental Attunement: Fire'],
      ['attunement flag falsy even with element stored', { attunementElement: 'Fire' }, 'not.toContain', 'Elemental Attunement'],
      ['epitome renders its chosen type', { epitomeActive: true, epitomeType: 'Fire' }, 'toContain', 'Elemental Epitome: Resistance to Fire'],
      ['epitome shows "not chosen" when type empty', { epitomeActive: true, epitomeType: '' }, 'toContain', 'Elemental Epitome: Resistance to not chosen'],
      ['epitome flag falsy even with type stored', { epitomeType: 'Fire' }, 'not.toContain', 'Elemental Epitome'],
      ['destructive stride renders its speed bonus', { destructiveActive: true }, 'toContain', 'Destructive Stride: +20 Speed'],
      ['destructive stride flag falsy', { destructiveActive: undefined }, 'not.toContain', 'Destructive Stride'],
    ])('%s', (_label, runtime, assertion, text) => {
      mockRuntime(runtime);
      const section = renderMonk(monkStats(2));
      if (assertion === 'toContain') {
        expect(section.textContent).toContain(text);
      } else {
        expect(section.textContent).not.toContain(text);
      }
    });
  });

  describe('stride of the elements', () => {
    it.each([
      ['ice_walk', 'Stride: Ice Walk'],
      ['speed_boost', 'Stride: +10 Speed'],
      ['fly_speed_equals_walk_speed', 'Stride: Fly Speed'],
      ['teleport_ready', 'Stride: Teleport 30 ft'],
      ['unknown_effect', 'Stride: Stride'],
    ])('maps effect "%s" to the full badge text "%s"', (effect, expectedText) => {
      mockRuntime({ buffs: [{ name: 'Stride of the Elements', effect }] });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain(expectedText);
    });

    it('ignores buffs with a stride-like effect but a different name', () => {
      mockRuntime({ buffs: [{ name: 'Something Else', effect: 'ice_walk' }] });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).not.toContain('Stride');
    });
  });

  it('survives a non-array activeBuffs value while still rendering the basics', () => {
    mockRuntime({ buffs: null });
    const section = renderMonk(monkStats(2));
    expect(section.textContent).toContain('Focus Save DC: 13');
    expect(section.textContent).not.toContain('Stride');
    expect(section.textContent).not.toContain('Cloak of Shadows');
    expect(section.textContent).not.toContain('Elemental');
  });
});
