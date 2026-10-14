// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Monk Features are reached through the CharClassFeatures registry entry
// point (class name 'Monk' → MonkFeatures).

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

  describe('level gating', () => {
    it('renders nothing below level 2 (Ki features unlock at level 2)', () => {
      render(<CharClassFeatures playerStats={monkStats(1)} campaignName={CAMPAIGN} />);
      expect(screen.queryByTestId('char-class-monk')).not.toBeInTheDocument();
    });

    it('renders the monk section at level 2', () => {
      const section = renderMonk(monkStats(2));
      expect(section).toBeInTheDocument();
      expect(section.textContent).toContain('Extra Attacks: 0');
      expect(section.textContent).toContain('Martial Arts Die: d4');
    });
  });

  describe('extra attacks', () => {
    it.each([
      [2, 'empty class_levels', [], 0],
      [5, 'extra_attacks on the current level entry', [null, null, null, null, { level: 5, extra_attacks: 2 }], 2],
      [5, 'current entry without extra_attacks', [null, null, null, null, { level: 5 }], 0],
      [5, 'extra_attacks on a lower level entry', [null, null, { level: 3, extra_attacks: 2 }], 0],
      [10, 'no entry at the current level index', [null, { level: 2, extra_attacks: 1 }], 0],
    ])('level %i with %s renders Extra Attacks: %i (reads class_levels[level - 1], never searches)', (level, _label, class_levels, expected) => {
      const stats = monkStats(level, {
        class: { name: 'Monk', major: {}, subclass: {}, class_levels, fightingStyles: [] },
      });
      const section = renderMonk(stats);
      expect(section.textContent).toContain(`Extra Attacks: ${expected}`);
    });
  });

  describe('focus points', () => {
    it('tracks Focus Points with max from class features', () => {
      mockMonkFeatures({ maxFocusPoints: 7 });
      renderMonk(monkStats(2));
      expect(screen.getByTestId('tracked-resource-focusPoints'))
        .toHaveTextContent('Focus Points: 7/7');
    });

    it('falls back to max 0 when maxFocusPoints is missing', () => {
      mockMonkFeatures({ maxFocusPoints: undefined });
      renderMonk(monkStats(2));
      expect(screen.getByTestId('tracked-resource-focusPoints'))
        .toHaveTextContent('Focus Points: 0/0');
    });
  });

  describe('focus save DC', () => {
    it.each([
      [3, 2, 13],
      [0, 2, 10],
      [3, 0, 11],
      [0, 0, 8],
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

  describe('martial arts die', () => {
    it.each([
      [4, 'Martial Arts Die: d4'],
      [6, 'Martial Arts Die: d6'],
      [8, 'Martial Arts Die: d8'],
      [10, 'Martial Arts Die: d10'],
      [undefined, 'Martial Arts Die: d0'],
    ])('class features die %s renders "%s"', (die, expectedText) => {
      mockMonkFeatures({ martialArtsDie: die });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain(expectedText);
    });
  });

  describe('unarmored movement', () => {
    it.each([
      [0, 'Unarmored Movement: +0 ft.'],
      [10, 'Unarmored Movement: +10 ft.'],
      [15, 'Unarmored Movement: +15 ft.'],
      [25, 'Unarmored Movement: +25 ft.'],
      [undefined, 'Unarmored Movement: +0 ft.'],
    ])('renders %s when class features report the bonus', (movement, expectedText) => {
      mockMonkFeatures({ unarmoredMovementIncrease: movement });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain(expectedText);
    });
  });

  describe('cloak of shadows', () => {
    it('renders the badge when the cloak_of_shadows effect is active', () => {
      mockRuntime({ buffs: [{ effect: 'cloak_of_shadows' }] });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain('Cloak of Shadows');
    });

    it.each([
      ['other effects are active', [{ effect: 'some_other_effect' }]],
      ['no buffs are active', []],
    ])('omits the badge when %s', (_label, buffs) => {
      mockRuntime({ buffs });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).not.toContain('Cloak of Shadows');
    });
  });

  describe('elemental attunement', () => {
    it('renders the badge with the attuned element when active', () => {
      mockRuntime({ attunementActive: true, attunementElement: 'Fire' });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain('Elemental Attunement: Fire');
    });

    it.each([
      ['false', false],
      ['undefined', undefined],
    ])('omits the badge when the flag is %s even with an element stored', (_label, active) => {
      mockRuntime({ attunementActive: active, attunementElement: 'Fire' });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).not.toContain('Elemental Attunement');
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

  describe('elemental epitome', () => {
    it('renders the resistance with its chosen type when active', () => {
      mockRuntime({ epitomeActive: true, epitomeType: 'Fire' });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain('Elemental Epitome: Resistance to Fire');
    });

    it('shows the "not chosen" fallback when the resistance type is empty', () => {
      mockRuntime({ epitomeActive: true, epitomeType: '' });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain('Elemental Epitome: Resistance to not chosen');
    });

    it.each([
      ['false', false],
      ['undefined', undefined],
    ])('omits the badge when the flag is %s even with a resistance type stored', (_label, active) => {
      mockRuntime({ epitomeActive: active, epitomeType: 'Fire' });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).not.toContain('Elemental Epitome');
    });
  });

  describe('destructive stride', () => {
    it('renders the badge with its speed bonus when active', () => {
      mockRuntime({ destructiveActive: true });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain('Destructive Stride: +20 Speed');
    });

    it.each([
      ['false', false],
      ['undefined', undefined],
    ])('omits the badge when the flag is %s', (_label, active) => {
      mockRuntime({ destructiveActive: active });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).not.toContain('Destructive Stride');
    });
  });

  describe('robustness', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('survives a non-array activeBuffs value (%s) while still rendering the basics', (_label, buffs) => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return buffs;
        return undefined;
      });
      const section = renderMonk(monkStats(2));
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
      expect(section.textContent).toContain('Focus Save DC: 13');
    });
  });
});
