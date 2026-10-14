// @maintained-by-ai
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

const recoveryStats = (level = 2) =>
  druidStats(level, { automation: { passives: [{ type: 'natural_recovery' }] } });

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

  it.each([
    [1, false],
    [2, true],
  ])('renders the druid section at level %i: %s (Wild Shape is a level 2 feature)', (level, expected) => {
    render(<CharClassFeatures playerStats={druidStats(level)} campaignName={CAMPAIGN} />);
    if (expected) expect(screen.getByTestId('char-class-druid')).toBeInTheDocument();
    else expect(screen.queryByTestId('char-class-druid')).not.toBeInTheDocument();
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

    it.each([
      ['shown when count is positive', 5, 'Beast Forms Known: 5'],
      ['hidden when count is zero', 0, null],
      ['hidden when count is undefined', undefined, null],
    ])('Beast Forms Known is %s', (_label, beastKnownForms, expectedText) => {
      mockDruidFeatures({ beastKnownForms });
      const section = renderDruid(druidStats(2));
      if (expectedText) expect(section.textContent).toContain(expectedText);
      else expect(section.textContent).not.toContain('Beast Forms Known');
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
      for (const resourceKey of ['cosmicomenUses', '_Star_Map_freeCastCount']) {
        const tracker = screen.queryByTestId(`tracked-resource-${resourceKey}`);
        if (expected) expect(tracker).toBeInTheDocument();
        else expect(tracker).not.toBeInTheDocument();
      }
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
      ['Fortune, even', JSON.stringify({ type: 'Fortune', isEven: true }), 'Cosmic Omen: Fortune (Even)'],
      ['Bane, odd', JSON.stringify({ type: 'Bane', isEven: false }), 'Cosmic Omen: Bane (Odd)'],
      ['Fortune with isEven absent', JSON.stringify({ type: 'Fortune' }), 'Cosmic Omen: Fortune (Odd)'],
      ['null', null, null],
      ['an empty string', '', null],
      ['invalid JSON', 'invalid json', null],
      ['JSON without a type', '{"isEven":true}', null],
    ])('renders the omen badge from cosmicOmenEffect %s', (_label, effect, expectedText) => {
      mockRuntime({ cosmicOmenEffect: effect });
      const section = renderDruid(starsStats(6));
      if (expectedText) expect(section.textContent).toContain(expectedText);
      else expect(section.textContent).not.toContain('Cosmic Omen:');
    });
  });

  describe('circle of the moon', () => {
    it.each([
      ['Circle of the Moon', true],
      ['Circle of the Land', false],
    ])('%s druids get Moonlight Step tracking: %s', (circle, expected) => {
      renderDruid(circleStats(circle, 10));
      const tracker = screen.queryByTestId('tracked-resource-moonlightStepUses');
      if (expected) expect(tracker).toBeInTheDocument();
      else expect(tracker).not.toBeInTheDocument();
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
      renderDruid(moonStats(10));
      const handler = vi.fn();
      window.addEventListener('moonlight-step-restore', handler);
      try {
        fireEvent.click(screen.getByRole('button', { name: /Restore Uses/i }));
        expect(handler).toHaveBeenCalledTimes(1);
      } finally {
        window.removeEventListener('moonlight-step-restore', handler);
      }
    });

    it.each([3, 9])('CLA-230: hides Restore Uses below level 10 (level %i)', (level) => {
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

    it.each([
      ['both fury choices', { elementalFury: 'Lightning', improvedElementalFury: 'Fire' },
        ['Elemental Fury: Lightning', 'Improved Elemental Fury: Fire']],
      ['only the improved fury choice', { improvedElementalFury: 'Thunder' },
        ['Improved Elemental Fury: Thunder']],
      ['no fury choices', {}, []],
    ])('renders fury badges independently from each other and from %s', (_label, furyRuntime, expectedBadges) => {
      mockRuntime(furyRuntime);
      const section = renderDruid(stormStats(18));
      const furyBadges = [...section.querySelectorAll('.automation-badge')]
        .map(el => el.textContent.trim())
        .filter(t => t.includes('Elemental Fury'));
      expect(furyBadges).toEqual(expectedBadges);
      expect(section.textContent).not.toContain('Circle of the Land');
    });
  });

  describe('natural recovery', () => {
    it('omits the section when no natural_recovery passive exists', () => {
      const section = renderDruid(druidStats(2));
      expect(section.textContent).not.toContain('Natural Recovery');
    });

    it('renders the section header when the passive exists, with no free-cast badges by default', () => {
      const section = renderDruid(recoveryStats());
      expect(section.textContent).toContain('Natural Recovery:');
      expect(section.textContent).not.toContain('Free cast');
    });

    it('badges the first selected free cast spell only', () => {
      mockGetRuntime({ freeCast: ['Moonbeam', 'Speak with Animals'] });
      const section = renderDruid(recoveryStats());
      expect(section.textContent).toContain('Free cast: Moonbeam');
      expect(section.textContent).not.toContain('Speak with Animals');
    });

    it.each([
      [true, true],
      [false, false],
      [null, false],
    ])('shows the free-cast-used badge only when the flag is truthy (%s)', (used, expected) => {
      mockGetRuntime({ freeCastUsed: used });
      const section = renderDruid(recoveryStats());
      expect(section.textContent.includes('Free cast used')).toBe(expected);
    });
  });

  it.each([
    ['true', true],
    ['false', false],
    ['undefined', false],
  ])('shows the Wrath of the Sea badge only when wrathOfTheSeaActive is %s', (_label, active) => {
    mockRuntime({ wrathOfTheSeaActive: active });
    const section = renderDruid(seaStats());
    // Match badge nodes (not raw textContent — the 'Circle of the Sea' badge
    // label contains 'Sea' and concatenates against adjacent badges).
    const wrathBadges = [...section.querySelectorAll('.automation-badge')]
      .filter(el => el.textContent.trim() === 'Wrath of the Sea Active');
    expect(wrathBadges).toHaveLength(active ? 1 : 0);
  });

  describe('multi-minute buff badges', () => {
    it.each([
      ['1_minute', true],
      ['10_minutes', true],
      ['hour', true],
      ['long_rest', true],
      ['while_illusion_active', true],
      ['instant', false],
      ['1_round', false],
      [undefined, false],
    ])('renders buff badge for duration %s: %s', (duration, expected) => {
      mockRuntime({ buffs: [{ name: 'Test Buff', duration }] });
      const section = renderDruid(druidStats(2));
      if (expected) expect(section.textContent).toContain(`Test Buff: ${duration}`);
      else expect(section.textContent).not.toContain('Test Buff');
    });

    it.each([
      // CLA-391: hours come from druid LEVEL ÷ 2, never wild_shape uses.
      // class_levels wild_shape: 4 would have produced the old buggy '2 hours'.
      [20, '10 hours'],
      [3, '1 hour'],
    ])('CLA-391: formats half_druid_level_hours at level %i as %s', (level, expected) => {
      mockRuntime({ buffs: [{ name: 'Wild Shape', effect: 'shape_shift', duration: 'half_druid_level_hours' }] });
      const stats = druidStats(level, {
        class: {
          name: 'Druid',
          major: {},
          subclass: {},
          class_levels: [{ level, wild_shape: 4 }],
          fightingStyles: [],
        },
      });
      const section = renderDruid(stats);
      expect(section.textContent).toContain(`Wild Shape: ${expected}`);
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
