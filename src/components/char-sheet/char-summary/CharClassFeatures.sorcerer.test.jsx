// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Sorcerer Features are reached through the CharClassFeatures registry entry
// point (class name 'Sorcerer' → SorcererFeatures, region testid 'char-class-sorcerer').
// Registry dispatch is owned by CharClassFeatures.test.jsx; the numeric rules
// behind the service values are owned by classRules.test.js — here we verify
// only the Sorcerer region's rendering behavior.

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

// Mirrors the shape classRules.getSorcererFeatures returns in the real
// service (5e lv5 baseline) — creatingSpellSlotCosts are plain numbers,
// mapped from class_specific.creating_spell_slots[].sorcery_point_cost.
const defaultSorcererFeatures = {
  maxSorceryPoints: 5,
  metamagicKnown: 2,
  maxInnateSorcery: 0,
  creatingSpellSlotCosts: [],
};

function mockSorcererFeatures(overrides = {}) {
  classFeatures.getClassFeatures.mockReturnValue({ ...defaultSorcererFeatures, ...overrides });
}

function mockRuntime({ buffs = [], tranceOfOrderActive = undefined } = {}) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    switch (key) {
      case 'activeBuffs': return buffs;
      case 'tranceOfOrderActive': return tranceOfOrderActive;
      default: return undefined;
    }
  });
}

function sorcererStats(level = 5, overrides = {}) {
  return {
    name: 'Test Sorcerer',
    level,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Sorcerer',
      class_levels: [{ level }],
      major: {},
      subclass: {},
      fightingStyles: [],
    },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    automation: { passives: [], specialActions: [] },
    ...overrides,
  };
}

function renderSorcerer(playerStats) {
  render(<CharClassFeatures playerStats={playerStats} campaignName={CAMPAIGN} />);
  return screen.getByTestId('char-class-sorcerer');
}

describe('SorcererFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorcererFeatures();
    mockRuntime();
  });

  it('reads class features for the exact playerStats object it was given', () => {
    const stats = sorcererStats();
    renderSorcerer(stats);
    expect(classFeatures.getClassFeatures).toHaveBeenCalledWith(stats);
  });

  it('tracks sorcery points, metamagic known, and innate sorcery with maxes from the service', () => {
    mockSorcererFeatures({ maxSorceryPoints: 7, metamagicKnown: 4, maxInnateSorcery: 2 });
    renderSorcerer(sorcererStats());
    expect(screen.getByTestId('tracked-resource-sorceryPoints')).toHaveTextContent('Sorcery Points: 7/7');
    expect(screen.getByTestId('tracked-resource-metamagicKnown')).toHaveTextContent('Metamagic Known: 4/4');
    expect(screen.getByTestId('tracked-resource-innateSorceryUses')).toHaveTextContent('Innate Sorcery: 2/2');
  });

  it('falls back to 0 max when the service omits every numeric field', () => {
    mockSorcererFeatures({ maxSorceryPoints: undefined, metamagicKnown: undefined, maxInnateSorcery: undefined });
    renderSorcerer(sorcererStats());
    expect(screen.getByTestId('tracked-resource-sorceryPoints')).toHaveTextContent('Sorcery Points: 0/0');
    expect(screen.getByTestId('tracked-resource-metamagicKnown')).toHaveTextContent('Metamagic Known: 0/0');
    expect(screen.getByTestId('tracked-resource-innateSorceryUses')).toHaveTextContent('Innate Sorcery: 0/0');
  });

  it.each([
    ['shown for a resource_restoration passive', [{ type: 'resource_restoration' }], true],
    ['hidden for any other passive', [{ type: 'something_else' }], false],
  ])('fixed 1/1 sorcerous restoration counter is %s', (_label, passives, expected) => {
    const stats = sorcererStats(20, { automation: { passives } });
    const section = renderSorcerer(stats);
    expect(section.textContent.includes('Sorcerous Restoration')).toBe(expected);
  });

  it('joins spell slot creation costs into the costs row', () => {
    mockSorcererFeatures({ creatingSpellSlotCosts: [2, 3, 5] });
    const section = renderSorcerer(sorcererStats());
    expect(section.textContent).toContain('Spell Slot (level 1-5) Costs: 2, 3, 5');
  });

  it.each([
    ['an empty array', []],
    ['undefined', undefined],
  ])('omits the costs row when the service returns %s', (_label, costs) => {
    mockSorcererFeatures({ creatingSpellSlotCosts: costs });
    const section = renderSorcerer(sorcererStats());
    expect(section.textContent).not.toContain('Spell Slot');
  });

  it.each([
    ['Innate Sorcery', '+1 Save DC, Spell Adv'],
    ['Telepathic Speech', 'Telepathic Speech'],
  ])('shows only the badge for the active %s buff', (buffName, badgeText) => {
    mockRuntime({ buffs: [{ name: buffName }] });
    const section = renderSorcerer(sorcererStats());
    expect(section.textContent).toContain(badgeText);
    // The other badge in this region is built from the same buff list and
    // must stay hidden: it only appears when its own buff is the active one.
    const otherBadgeText = badgeText === '+1 Save DC, Spell Adv' ? 'Telepathic Speech' : '+1 Save DC, Spell Adv';
    expect(section.textContent).not.toContain(otherBadgeText);
  });

  it('survives a non-array activeBuffs value while still rendering its resources', () => {
    mockRuntime({ buffs: null });
    const section = renderSorcerer(sorcererStats());
    expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
    expect(screen.getByTestId('tracked-resource-sorceryPoints')).toHaveTextContent('Sorcery Points: 5/5');
  });

  describe('revelation in flesh effect mapping', () => {
    it.each([
      ['aquatic_adaptation', 'Aquatic Adaptation'],
      ['glistening_flight', 'Glistening Flight'],
      ['see_the_invisible', 'See the Invisible'],
      ['wormhole_movement', 'Wormhole Movement'],
      // Unmapped effects fall back to the raw feature name.
      ['mystery_effect', 'Revelation in Flesh'],
    ])('displays "$label" for effect "$effect"', (effect, label) => {
      mockRuntime({ buffs: [{ name: 'Revelation in Flesh', effect }] });
      renderSorcerer(sorcererStats());
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('renders multiple revelation effects in one comma-joined badge', () => {
      mockRuntime({
        buffs: [
          { name: 'Revelation in Flesh', effect: 'aquatic_adaptation' },
          { name: 'Revelation in Flesh', effect: 'glistening_flight' },
        ],
      });
      renderSorcerer(sorcererStats());
      const badge = screen.getByText('Aquatic Adaptation, Glistening Flight');
      expect(badge.className).toContain('automation-badge');
    });

    it('ignores matching effects carried by a differently-named buff', () => {
      mockRuntime({ buffs: [{ name: 'Other Feature', effect: 'aquatic_adaptation' }] });
      const section = renderSorcerer(sorcererStats());
      expect(section.textContent).not.toContain('Aquatic Adaptation');
    });
  });

  it.each([
    ['true', true, true],
    ['false', false, false],
    ['the string "true" (strict === guard)', 'true', false],
    ['undefined (never set)', undefined, false],
  ])('trance of order badge renders when the flag is %s', (_label, flag, expected) => {
    mockRuntime({ tranceOfOrderActive: flag });
    const section = renderSorcerer(sorcererStats(18));
    expect(section.textContent.includes('Trance of Order')).toBe(expected);
  });

  it('renders dodge, adrenaline rush, and stonecunning alongside the sorcerer region', () => {
    mockRuntime({ buffs: [{ effect: 'dodge' }] });
    const stats = sorcererStats(5, {
      proficiency: 3,
      automation: { passives: [], specialActions: [{ effect: 'bonus_action_dash' }] },
      race: { traits: [{ name: 'Stonecunning', automation: true }] },
    });
    renderSorcerer(stats);
    expect(screen.getByText('Dodge — Disadv on attacks vs you, Adv on DEX saves')).toBeInTheDocument();
    expect(screen.getByTestId('tracked-resource-adrenalineRushUses')).toHaveTextContent('Adrenaline Rush: 3/3');
    expect(screen.getByTestId('tracked-resource-stonecunningUses')).toHaveTextContent('Stonecunning: 3/3');
    expect(screen.getByTestId('tracked-resource-sorceryPoints')).toHaveTextContent('Sorcery Points: 5/5');
  });
});
