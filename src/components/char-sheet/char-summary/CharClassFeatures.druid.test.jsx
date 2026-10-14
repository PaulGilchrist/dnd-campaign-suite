// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Druid Features are reached through the CharClassFeatures registry entry
// point (class name 'Druid' → DruidFeatures).

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

// Mirrors the shape getDruidFeatures returns in the real service
// (5e lv2 baseline).
const defaultDruidFeatures = {
  maxWildShapeUses: 2,
  maxWildShapeChallengeRating: 1,
  beastKnownForms: 0,
  wildShapeLimitations: 'walk only (no swim or fly)',
};

function mockDruidFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({ ...defaultDruidFeatures, ...overrides });
}

function mockRuntime({
  buffs = [],
  cosmicOmenEffect = undefined,
  circleOfTheLandType = undefined,
  elementalFury = undefined,
  improvedElementalFury = undefined,
  wrathOfTheSeaActive = undefined,
} = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    switch (key) {
      case 'activeBuffs': return buffs;
      case 'cosmicOmenEffect': return cosmicOmenEffect;
      case '_circleOfTheLandType': return circleOfTheLandType;
      case '_Elemental_Fury_option': return elementalFury;
      case '_Improved_Elemental_Fury_option': return improvedElementalFury;
      case 'wrathOfTheSeaActive': return wrathOfTheSeaActive;
      default: return undefined;
    }
  });
}

// Natural Recovery values are read via standalone getRuntimeValue (no campaign arg).
function mockGetRuntime({ freeCast = null, freeCastUsed = null } = {}) {
  runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'naturalRecoveryFreeCast') return freeCast;
    if (key === 'naturalRecoveryFreeCastUsed') return freeCastUsed;
    return null;
  });
}

function druidStats(level, overrides = {}) {
  return {
    name: 'Test Druid',
    level,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Druid',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    automation: { passives: [] },
    ...overrides,
  };
}

function circleStats(circle, level, overrides = {}) {
  return druidStats(level, {
    class: {
      name: 'Druid',
      major: { name: circle },
      subclass: { name: circle },
      class_levels: [],
      fightingStyles: [],
    },
    ...overrides,
  });
}

const starsStats = (level, overrides = {}) => circleStats('Circle of the Stars', level, overrides);
const moonStats = (level, overrides = {}) => circleStats('Circle of the Moon', level, overrides);
const landStats = (level, overrides = {}) => circleStats('Circle of the Land', level, overrides);
const stormStats = (level, overrides = {}) => circleStats('Circle of the Storm', level, overrides);
const seaStats = (level = 2, overrides = {}) => circleStats('Circle of the Sea', level, overrides);

function renderDruid(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
  return screen.getByTestId('char-class-druid');
}

describe('DruidFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDruidFeatures();
    mockRuntime();
    mockGetRuntime();
  });

  describe('level gating', () => {
    it('renders nothing below level 2 (Wild Shape is a level 2 feature)', () => {
      render(<CharClassFeatures playerStats={druidStats(1)} campaignName={CAMPAIGN} />);
      expect(screen.queryByTestId('char-class-druid')).not.toBeInTheDocument();
    });

    it('renders the druid section at level 2', () => {
      const section = renderDruid(druidStats(2));
      expect(section).toBeInTheDocument();
    });
  });

  describe('wild shape basics', () => {
    it('passes limitations and challenge rating values through from class features', () => {
      mockDruidFeatures({
        wildShapeLimitations: 'swim, but not fly',
        maxWildShapeChallengeRating: 3,
      });
      const section = renderDruid(druidStats(4));
      expect(section.textContent).toContain('Wild Shape Limitations: swim, but not fly');
      expect(section.textContent).toContain('Wild Shape Max Challenge Rating: 3');
    });

    it('tracks Wild Shape Uses with max from maxWildShapeUses', () => {
      mockDruidFeatures({ maxWildShapeUses: 3 });
      renderDruid(druidStats(2));
      expect(screen.getByTestId('tracked-resource-wildShapeUses'))
        .toHaveTextContent('Wild Shape Uses: 3/3');
    });

    it('lists Beast Forms Known when the count is positive', () => {
      mockDruidFeatures({ beastKnownForms: 5 });
      const section = renderDruid(druidStats(2));
      expect(section.textContent).toContain('Beast Forms Known: 5');
    });

    it.each([
      ['zero forms', 0],
      ['count is undefined', undefined],
    ])('omits Beast Forms Known when %s', (_label, beastKnownForms) => {
      mockDruidFeatures({ beastKnownForms });
      const section = renderDruid(druidStats(2));
      expect(section.textContent).not.toContain('Beast Forms Known');
    });

    it('CLA-013: renders Unlimited (Archdruid) badge instead of a counter when max is Infinity', () => {
      mockDruidFeatures({ maxWildShapeUses: Infinity });
      const section = renderDruid(druidStats(20));
      expect(screen.queryByTestId('tracked-resource-wildShapeUses')).not.toBeInTheDocument();
      expect(section.textContent).toContain('Unlimited');
      expect(section.textContent).toContain('(Archdruid)');
    });
  });

  describe('circle of the stars', () => {
    it.each([
      [2, false],
      [5, false],
      [6, true],
      [20, true],
    ])('at level %i renders cosmic omen tracked resources: %s', (level, expected) => {
      renderDruid(starsStats(level));
      const check = (label) => {
        const query = screen.queryByText(label);
        if (expected) expect(query).toBeInTheDocument();
        else expect(query).not.toBeInTheDocument();
      };
      check('Cosmic Omen Uses:');
      check('Star Map Free Casts:');
    });

    it.each([
      [5, '5/5'],
      [0, '1/1'],
      [-2, '1/1'],
    ])('caps cosmic omen and star map max at max(WIS,1) for WIS %i', (wisBonus, expected) => {
      renderDruid(starsStats(6, { abilities: [{ name: 'Wisdom', bonus: wisBonus }] }));
      expect(screen.getByTestId('tracked-resource-cosmicomenUses'))
        .toHaveTextContent(`Cosmic Omen Uses: ${expected}`);
      expect(screen.getByTestId('tracked-resource-_Star_Map_freeCastCount'))
        .toHaveTextContent(`Star Map Free Casts: ${expected}`);
    });

    it.each([
      ['Fortune, even', { type: 'Fortune', isEven: true }, 'Cosmic Omen: Fortune (Even)'],
      ['Bane, odd', { type: 'Bane', isEven: false }, 'Cosmic Omen: Bane (Odd)'],
      ['Fortune with isEven absent (Odd)', { type: 'Fortune' }, 'Cosmic Omen: Fortune (Odd)'],
    ])('renders the omen badge for %s', (_label, effect, expectedText) => {
      mockRuntime({ cosmicOmenEffect: JSON.stringify(effect) });
      const section = renderDruid(starsStats(6));
      expect(section.textContent).toContain(expectedText);
    });

    it.each([
      ['null', null],
      ['an empty string', ''],
      ['invalid JSON', 'invalid json'],
      ['JSON without a type', '{"isEven":true}'],
    ])('omits the omen badge when the effect is %s', (_label, effect) => {
      mockRuntime({ cosmicOmenEffect: effect });
      const section = renderDruid(starsStats(6));
      expect(section.textContent).not.toContain('Cosmic Omen:');
    });
  });

  describe('circle of the moon', () => {
    it('tracks Moonlight Step Uses for moon druids', () => {
      renderDruid(moonStats(10));
      expect(screen.getByTestId('tracked-resource-moonlightStepUses')).toBeInTheDocument();
    });

    it('omits Moonlight Step Uses for non-moon circles', () => {
      const section = renderDruid(landStats(10));
      expect(screen.queryByTestId('tracked-resource-moonlightStepUses')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Moonlight Step');
    });

    it.each([
      [3, '3/3'],
      [0, '1/1'],
      [-2, '1/1'],
    ])('caps Moonlight Step max at max(WIS,1) for WIS %i', (wisBonus, expected) => {
      renderDruid(moonStats(10, { abilities: [{ name: 'Wisdom', bonus: wisBonus }] }));
      expect(screen.getByTestId('tracked-resource-moonlightStepUses'))
        .toHaveTextContent(`Moonlight Step Uses: ${expected}`);
    });

    it('CLA-230: Restore Uses button dispatches the moonlight-step-restore bus event', () => {
      const section = renderDruid(moonStats(10));
      const handler = vi.fn();
      window.addEventListener('moonlight-step-restore', handler);
      try {
        fireEvent.click(screen.getByRole('button', { name: /Restore Uses/i }));
        expect(handler).toHaveBeenCalledTimes(1);
        expect(section.querySelector('.moonlight-step-restore-btn')).not.toBeNull();
      } finally {
        window.removeEventListener('moonlight-step-restore', handler);
      }
    });

    it.each([3, 9])('CLA-230: hides Restore Uses at level %i (unlocks at 10)', (level) => {
      renderDruid(moonStats(level));
      expect(screen.queryByRole('button', { name: /Restore Uses/i })).not.toBeInTheDocument();
    });
  });

  describe('circle badges (land and storm)', () => {
    it('renders the Circle of the Land badge with its chosen type', () => {
      mockRuntime({ circleOfTheLandType: 'Forest' });
      const section = renderDruid(landStats(3));
      expect(section.textContent).toContain('Circle of the Land: Forest');
    });

    it.each([
      ['null', null],
      ['an empty string', ''],
      ['undefined', undefined],
    ])('omits the Circle of the Land badge when the type is %s', (_label, type) => {
      mockRuntime({ circleOfTheLandType: type });
      const section = renderDruid(landStats(3));
      expect(section.textContent).not.toContain('Circle of the Land');
    });

    it('renders elemental fury badges for the storm druid without needing a land type', () => {
      mockRuntime({ elementalFury: 'Lightning', improvedElementalFury: 'Fire' });
      const section = renderDruid(stormStats(18));
      expect(section.textContent).toContain('Elemental Fury: Lightning');
      expect(section.textContent).toContain('Improved Elemental Fury: Fire');
      expect(section.textContent).not.toContain('Circle of the Land');
    });

    it('renders fury badges independently of the land type when only choices are set', () => {
      mockRuntime({ improvedElementalFury: 'Thunder' });
      const section = renderDruid(stormStats(18));
      const badgeTexts = [...section.querySelectorAll('.automation-badge')].map(el => el.textContent.trim());
      expect(badgeTexts).toContain('Improved Elemental Fury: Thunder');
      expect(badgeTexts.filter(t => t.startsWith('Elemental Fury:'))).toHaveLength(0);
      expect(section.textContent).not.toContain('Circle of the Land');
    });

    it('omits elemental fury badges when no choices are set', () => {
      const section = renderDruid(stormStats(18));
      expect(section.textContent).not.toContain('Elemental Fury');
    });
  });

  describe('natural recovery', () => {
    it('omits the section when no natural_recovery passive exists', () => {
      const section = renderDruid(druidStats(2));
      expect(section.textContent).not.toContain('Natural Recovery');
    });

    it('renders the section header when the passive exists', () => {
      const stats = druidStats(2, { automation: { passives: [{ type: 'natural_recovery' }] } });
      const section = renderDruid(stats);
      expect(section.textContent).toContain('Natural Recovery:');
      expect(section.textContent).not.toContain('Free cast');
    });

    it('badges the first selected free cast spell', () => {
      mockGetRuntime({ freeCast: ['Moonbeam', 'Speak with Animals'] });
      const stats = druidStats(2, { automation: { passives: [{ type: 'natural_recovery' }] } });
      const section = renderDruid(stats);
      expect(section.textContent).toContain('Free cast: Moonbeam');
      expect(section.textContent).not.toContain('Speak with Animals');
    });

    it.each([
      [true, true],
      [false, false],
      [null, false],
    ])('shows the free-cast-used badge only when the flag is truthy (%s)', (used, expected) => {
      mockGetRuntime({ freeCastUsed: used });
      const stats = druidStats(2, { automation: { passives: [{ type: 'natural_recovery' }] } });
      const section = renderDruid(stats);
      expect(section.textContent.includes('Free cast used')).toBe(expected);
    });
  });

  describe('wrath of the sea', () => {
    it('renders the active badge when wrathOfTheSeaActive is true', () => {
      mockRuntime({ wrathOfTheSeaActive: true });
      const section = renderDruid(seaStats());
      expect(section.textContent).toContain('Wrath of the Sea Active');
    });

    it.each([
      ['false', false],
      ['undefined', undefined],
    ])('omits the badge when the flag is %s', (_label, active) => {
      mockRuntime({ wrathOfTheSeaActive: active });
      const section = renderDruid(seaStats());
      expect(section.textContent).not.toContain('Wrath of the Sea Active');
    });
  });

  describe('multi-minute buff badges', () => {
    it.each([
      ['1_minute'],
      ['hour'],
      ['long_rest'],
      ['while_illusion_active'],
    ])('renders a badge for %s duration', (duration) => {
      mockRuntime({ buffs: [{ name: 'Test Buff', duration }] });
      const section = renderDruid(druidStats(2));
      expect(section.textContent).toContain(`Test Buff: ${duration}`);
    });

    it.each([
      ['combat-scoped round', '1_round'],
      ['instant', 'instant'],
      ['missing duration', undefined],
    ])('filters out %s', (_label, duration) => {
      mockRuntime({ buffs: [{ name: 'Test Buff', duration }] });
      const section = renderDruid(druidStats(2));
      expect(section.textContent).not.toContain('Test Buff');
    });

    it('CLA-391: formats half_druid_level_hours from druid LEVEL, not wild shape uses', () => {
      mockRuntime({ buffs: [{ name: 'Wild Shape', effect: 'shape_shift', duration: 'half_druid_level_hours' }] });
      const stats = druidStats(20, {
        class: {
          name: 'Druid',
          major: {},
          subclass: {},
          class_levels: [{ level: 20, wild_shape: 4 }],
          fightingStyles: [],
        },
      });
      const section = renderDruid(stats);
      expect(section.textContent).toContain('Wild Shape: 10 hours');
      expect(section.textContent).not.toContain('Wild Shape: 2 hours');
    });

    it('pluralizes half_druid_level_hours for odd levels (lv3 → 1 hour)', () => {
      mockRuntime({ buffs: [{ name: 'Test Buff', duration: 'half_druid_level_hours' }] });
      const section = renderDruid(druidStats(3));
      expect(section.textContent).toContain('Test Buff: 1 hour');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('survives a non-array activeBuffs value (%s) while still rendering wild shape basics', (_label, buffs) => {
      mockRuntime({ buffs });
      const section = renderDruid(druidStats(2));
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
      expect(section.textContent).toContain('Wild Shape Limitations:');
    });
  });
});
