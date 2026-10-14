// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// Sorcerer Features are reached through the CharClassFeatures registry entry
// point (class name 'Sorcerer' → SorcererFeatures, region testid 'char-class-sorcerer').

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

  describe('class features wiring', () => {
    it('reads class features for the exact playerStats object it was given', () => {
      const stats = sorcererStats();
      renderSorcerer(stats);
      expect(classFeatures.getClassFeatures).toHaveBeenCalledWith(stats);
    });
  });

  describe('tracked resources', () => {
    it.each([
      ['Sorcery Points', 'sorceryPoints', 5, { maxSorceryPoints: 5 }],
      ['Sorcery Points', 'sorceryPoints', 7, { maxSorceryPoints: 7 }],
      ['Metamagic Known', 'metamagicKnown', 2, { metamagicKnown: 2 }],
      ['Metamagic Known', 'metamagicKnown', 4, { metamagicKnown: 4 }],
      ['Innate Sorcery', 'innateSorceryUses', 2, { maxInnateSorcery: 2 }],
    ])('tracks %s with max %i from the service', (_label, testId, expected, overrides) => {
      mockSorcererFeatures(overrides);
      renderSorcerer(sorcererStats());
      expect(screen.getByTestId(`tracked-resource-${testId}`))
        .toHaveTextContent(`${_label}: ${expected}/${expected}`);
    });

    it('falls back to 0 max when the service omits every numeric field', () => {
      mockSorcererFeatures({ maxSorceryPoints: undefined, metamagicKnown: undefined, maxInnateSorcery: undefined });
      renderSorcerer(sorcererStats());
      expect(screen.getByTestId('tracked-resource-sorceryPoints')).toHaveTextContent('Sorcery Points: 0/0');
      expect(screen.getByTestId('tracked-resource-metamagicKnown')).toHaveTextContent('Metamagic Known: 0/0');
      expect(screen.getByTestId('tracked-resource-innateSorceryUses')).toHaveTextContent('Innate Sorcery: 0/0');
    });
  });

  describe('sorcerous restoration', () => {
    it('renders the fixed 1/1 counter when a resource_restoration passive exists', () => {
      const stats = sorcererStats(20, { automation: { passives: [{ type: 'resource_restoration' }] } });
      renderSorcerer(stats);
      expect(screen.getByTestId('tracked-resource-sorcerousRestorationUses'))
        .toHaveTextContent('Sorcerous Restoration: 1/1');
    });

    it('omits the counter when no resource_restoration passive exists', () => {
      const stats = sorcererStats(20, { automation: { passives: [{ type: 'something_else' }] } });
      const section = renderSorcerer(stats);
      expect(screen.queryByTestId('tracked-resource-sorcerousRestorationUses')).not.toBeInTheDocument();
      expect(section.textContent).not.toContain('Sorcerous Restoration');
    });
  });

  describe('spell slot creation costs', () => {
    it.each([
      [[2], '2'],
      [[2, 3, 5], '2, 3, 5'],
    ])('joins numeric costs %j into the costs row', (costs, expectedText) => {
      mockSorcererFeatures({ creatingSpellSlotCosts: costs });
      const section = renderSorcerer(sorcererStats());
      expect(section.textContent).toContain(`Spell Slot (level 1-5) Costs: ${expectedText}`);
    });

    it.each([
      ['an empty array', []],
      ['undefined', undefined],
    ])('omits the costs row when the service returns %s', (_label, costs) => {
      mockSorcererFeatures({ creatingSpellSlotCosts: costs });
      const section = renderSorcerer(sorcererStats());
      expect(section.textContent).not.toContain('Spell Slot');
    });
  });

  describe('buff badges', () => {
    it('shows the innate sorcery badge while the buff is active', () => {
      mockRuntime({ buffs: [{ name: 'Innate Sorcery' }] });
      const section = renderSorcerer(sorcererStats());
      expect(section.textContent).toContain('+1 Save DC, Spell Adv');
    });

    it('omits the innate sorcery badge when the buff is not active', () => {
      mockRuntime({ buffs: [{ name: 'Telepathic Speech' }] });
      const section = renderSorcerer(sorcererStats());
      expect(section.textContent).not.toContain('+1 Save DC, Spell Adv');
    });

    it('shows the telepathic speech badge while the buff is active', () => {
      mockRuntime({ buffs: [{ name: 'Telepathic Speech' }] });
      renderSorcerer(sorcererStats());
      const badge = screen.getByText('Telepathic Speech');
      expect(badge.className).toContain('automation-badge');
    });

    it('omits the telepathic speech badge when the buff is not active', () => {
      mockRuntime({ buffs: [{ name: 'Innate Sorcery' }] });
      const section = renderSorcerer(sorcererStats());
      expect(section.textContent).not.toContain('Telepathic Speech');
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('survives a non-array activeBuffs value (%s) while still rendering its resources', (_label, buffs) => {
      mockRuntime({ buffs });
      const section = renderSorcerer(sorcererStats());
      expect(section.querySelectorAll('.automation-badge')).toHaveLength(0);
      expect(screen.getByTestId('tracked-resource-sorceryPoints')).toHaveTextContent('Sorcery Points: 5/5');
    });
  });

  describe('revelation in flesh effect mapping', () => {
    it.each([
      ['aquatic_adaptation', 'Aquatic Adaptation'],
      ['glistening_flight', 'Glistening Flight'],
      ['see_the_invisible', 'See the Invisible'],
      ['wormhole_movement', 'Wormhole Movement'],
    ])('displays "$label" for effect "$effect"', (effect, label) => {
      mockRuntime({ buffs: [{ name: 'Revelation in Flesh', effect }] });
      const section = renderSorcerer(sorcererStats());
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(section.textContent).toContain(label);
    });

    it('falls back to the raw feature name for an unmapped effect', () => {
      mockRuntime({ buffs: [{ name: 'Revelation in Flesh', effect: 'mystery_effect' }] });
      const section = renderSorcerer(sorcererStats());
      expect(screen.getByText('Revelation in Flesh')).toBeInTheDocument();
      expect(section.textContent).not.toContain('Mystery');
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
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('automation-badge');
    });

    it('ignores matching effects carried by a differently-named buff', () => {
      mockRuntime({ buffs: [{ name: 'Other Feature', effect: 'aquatic_adaptation' }] });
      const section = renderSorcerer(sorcererStats());
      expect(section.textContent).not.toContain('Aquatic Adaptation');
    });
  });

  describe('trance of order', () => {
    it('shows the badge when tranceOfOrderActive is strictly true', () => {
      mockRuntime({ tranceOfOrderActive: true });
      const section = renderSorcerer(sorcererStats(18));
      expect(section.textContent).toContain('Trance of Order');
    });

    it.each([
      ['false', false],
      ['the string "true" (strict === guard)', 'true'],
      ['1 (strict === guard)', 1],
      ['undefined (never set)', undefined],
    ])('omits the badge when the flag is %s', (_label, active) => {
      mockRuntime({ tranceOfOrderActive: active });
      const section = renderSorcerer(sorcererStats(18));
      expect(section.textContent).not.toContain('Trance of Order');
    });
  });

  describe('coexistence with entry-point features', () => {
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
});
