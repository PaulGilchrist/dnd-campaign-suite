// @maintained-by-ai
/**
 * Monk lane of the CharClassFeatures registry entry point
 * (class name 'Monk' → MonkFeatures). Owns display of monk-specific
 * values and runtime badges; registry dispatch itself is pinned by
 * CharClassFeatures.test.jsx — do not duplicate it here.
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
    // Reads class_levels[level - 1] exactly — never searches other entries.
    it.each([
      [5, [null, null, null, null, { level: 5, extra_attacks: 2 }], 2],
      [5, [null, null, null, null, { level: 5 }], 0],
      [10, [null, { level: 2, extra_attacks: 1 }], 0],
    ])('level %i with class_levels %j renders Extra Attacks: %i', (level, class_levels, expected) => {
      const stats = monkStats(level, {
        class: { name: 'Monk', major: {}, subclass: {}, class_levels, fightingStyles: [] },
      });
      const section = renderMonk(stats);
      expect(section.textContent).toContain(`Extra Attacks: ${expected}`);
    });
  });

  it('tracks Focus Points with the max from class features, falling back to 0', () => {
    mockMonkFeatures({ maxFocusPoints: 7 });
    renderMonk(monkStats(2));
    expect(screen.getByTestId('tracked-resource-focusPoints'))
      .toHaveTextContent('Focus Points: 7/7');

    mockMonkFeatures({ maxFocusPoints: undefined });
    render(<CharClassFeatures playerStats={monkStats(2)} campaignName={CAMPAIGN} />);
    expect(screen.getAllByTestId('tracked-resource-focusPoints').at(-1))
      .toHaveTextContent('Focus Points: 0/0');
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

  it('renders martial arts die and unarmored movement from class features', () => {
    mockMonkFeatures({ martialArtsDie: 8, unarmoredMovementIncrease: 15 });
    const section = renderMonk(monkStats(2));
    expect(section.textContent).toContain('Martial Arts Die: d8');
    expect(section.textContent).toContain('Unarmored Movement: +15 ft.');
  });

  it('shows zero fallbacks when class features omit die and movement values', () => {
    mockMonkFeatures({ martialArtsDie: undefined, unarmoredMovementIncrease: undefined });
    const section = renderMonk(monkStats(2));
    expect(section.textContent).toContain('Martial Arts Die: d0');
    expect(section.textContent).toContain('Unarmored Movement: +0 ft.');
  });

  describe('cloak of shadows', () => {
    it('renders the badge when the cloak_of_shadows effect is active', () => {
      mockRuntime({ buffs: [{ effect: 'cloak_of_shadows' }] });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).toContain('Cloak of Shadows');
    });

    it('omits the badge for unrelated buffs', () => {
      mockRuntime({ buffs: [{ effect: 'some_other_effect' }] });
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

    it('omits the badge when the flag is falsy even with an element stored', () => {
      mockRuntime({ attunementActive: undefined, attunementElement: 'Fire' });
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

    it('omits the badge when the flag is falsy even with a resistance type stored', () => {
      mockRuntime({ epitomeActive: undefined, epitomeType: 'Fire' });
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

    it('omits the badge when the flag is falsy', () => {
      mockRuntime({ destructiveActive: undefined });
      const section = renderMonk(monkStats(2));
      expect(section.textContent).not.toContain('Destructive Stride');
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
