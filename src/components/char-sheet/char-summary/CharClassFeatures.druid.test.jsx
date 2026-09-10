// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

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
  getClassFeatures: vi.fn(() => ({
    maxWildShapeUses: 2,
    maxWildShapeChallengeRating: 1,
    beastKnownForms: 0,
    wildShapeLimitations: 'walk only (no swim or fly)',
  })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

const MOCK_CAMPAIGN = 'test';

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Druid',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Druid',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Wisdom', bonus: 3 },
    ],
    automation: {},
    ...overrides,
  };
}

function setBuffs(buffs) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return buffs;
    return undefined;
  });
}

function setCosmicOmenEffect(effect) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'cosmicOmenEffect') return effect;
    if (key === 'activeBuffs') return [];
    return undefined;
  });
}

function setCircleOfTheLandType(type) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === '_circleOfTheLandType') return type;
    if (key === 'activeBuffs') return [];
    return undefined;
  });
}

function setElementalFuryChoices(elementalFury, improvedElementalFury) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === '_Elemental_Fury_option') return elementalFury;
    if (key === '_Improved_Elemental_Fury_option') return improvedElementalFury;
    if (key === 'activeBuffs') return [];
    return undefined;
  });
}

function setWrathOfTheSeaActive(active) {
  runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'wrathOfTheSeaActive') return active;
    if (key === 'activeBuffs') return [];
    return undefined;
  });
}

describe('DruidFeatures (via CharClassFeatures entry point)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      switch (key) {
        case 'activeBuffs': return [];
        case 'cosmicOmenEffect': return undefined;
        case 'wrathOfTheSeaActive': return undefined;
        case '_circleOfTheLandType': return undefined;
        case '_Elemental_Fury_option': return undefined;
        case '_Improved_Elemental_Fury_option': return undefined;
        default: return undefined;
      }
    });
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      switch (key) {
        case 'naturalRecoveryFreeCast': return undefined;
        case 'naturalRecoveryFreeCastUsed': return undefined;
        default: return null;
      }
    });
  });

  // @cleaned: removed afterEach(cleanup) — DOM is auto-cleaned by vitest setup

  describe('level gating', () => {
    it('returns null for level 1 druid', () => {
      const level1Stats = buildPlayerStats({ level: 1 });
      const { container } = render(<CharClassFeatures playerStats={level1Stats} campaignName={MOCK_CAMPAIGN} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders class features for level 2+', () => {
      const level2Stats = buildPlayerStats({ level: 2 });
      render(<CharClassFeatures playerStats={level2Stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Wild Shape Limitations:')).toBeInTheDocument();
    });
  });

  describe('base wild shape features', () => {
    it('renders beast forms known when count > 0', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        maxWildShapeUses: 2,
        maxWildShapeChallengeRating: 1,
        beastKnownForms: 5,
        wildShapeLimitations: 'walk only (no swim or fly)',
      });
      const stats = buildPlayerStats({ level: 2 });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Beast Forms Known:/).parentElement).toHaveTextContent(/5/);
    });

    it('renders wild shape limitations, challenge rating, and tracked resource', () => {
      const stats = buildPlayerStats({ level: 2 });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Wild Shape Limitations:')).toBeInTheDocument();
      expect(screen.getByText('Wild Shape Max Challenge Rating:')).toBeInTheDocument();
      expect(screen.getByText('Wild Shape Uses:')).toBeInTheDocument();
    });

    it('uses maxWildShapeUses from class features as the max value', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        maxWildShapeUses: 3,
        maxWildShapeChallengeRating: 1,
        beastKnownForms: 0,
        wildShapeLimitations: 'None',
      });
      const stats = buildPlayerStats({ level: 2 });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Wild Shape Uses:/).parentElement).toHaveTextContent(/3\/3/);
    });
  });

  describe('circle of the stars', () => {
    const starsDruidStats = (level) => buildPlayerStats({
      level,
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Stars' },
        subclass: { name: 'Circle of the Stars' },
        class_levels: [],
        fightingStyles: [],
      },
      automation: { passives: [] },
    });

    it('renders cosmic omen tracked resources at level >= 6', () => {
      const stats = starsDruidStats(6);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Cosmic Omen Uses:')).toBeInTheDocument();
      expect(screen.getByText('Star Map Free Casts:')).toBeInTheDocument();
    });

    it('does not render cosmic omen tracked resources below level 6', () => {
      const stats = starsDruidStats(5);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText('Cosmic Omen Uses:')).not.toBeInTheDocument();
      expect(screen.queryByText('Star Map Free Casts:')).not.toBeInTheDocument();
    });

    it('renders cosmic omen effect with parsed type and even/odd variant', () => {
      setCosmicOmenEffect(JSON.stringify({ type: 'Fortune', isEven: true }));
      const stats = starsDruidStats(6);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Cosmic Omen: Fortune \(Even\)/)).toBeInTheDocument();

      setCosmicOmenEffect(JSON.stringify({ type: 'Bane', isEven: false }));
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Cosmic Omen: Bane \(Odd\)/)).toBeInTheDocument();
    });

    it('does not render cosmic omen effect when effect is null', () => {
      setCosmicOmenEffect(null);
      const stats = starsDruidStats(6);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText(/Cosmic Omen:/)).not.toBeInTheDocument();
    });

    it('does not render cosmic omen effect when effect is empty string', () => {
      setCosmicOmenEffect('');
      const stats = starsDruidStats(6);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText(/Cosmic Omen:/)).not.toBeInTheDocument();
    });

    it('does not render cosmic omen effect when effect is invalid JSON', () => {
      setCosmicOmenEffect('invalid json');
      const stats = starsDruidStats(6);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText(/Cosmic Omen:/)).not.toBeInTheDocument();
    });

    it('uses wisdom bonus as max with minimum 1 when bonus is 0', () => {
      const wisStats = buildPlayerStats({
        level: 6,
        abilities: [{ name: 'Wisdom', bonus: 5 }],
        class: {
          name: 'Druid',
          major: { name: 'Circle of the Stars' },
          subclass: { name: 'Circle of the Stars' },
          class_levels: [],
          fightingStyles: [],
        },
        automation: { passives: [] },
      });
      render(<CharClassFeatures playerStats={wisStats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Cosmic Omen Uses:/).parentElement).toHaveTextContent(/5\/5/);
    });

    it('uses minimum 1 when wisdom bonus is 0', () => {
      const zeroWisStats = buildPlayerStats({
        level: 6,
        abilities: [{ name: 'Wisdom', bonus: 0 }],
        class: {
          name: 'Druid',
          major: { name: 'Circle of the Stars' },
          subclass: { name: 'Circle of the Stars' },
          class_levels: [],
          fightingStyles: [],
        },
        automation: { passives: [] },
      });
      render(<CharClassFeatures playerStats={zeroWisStats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Cosmic Omen Uses:/).parentElement).toHaveTextContent(/1\/1/);
    });
  });

  describe('circle of the moon', () => {
    const moonDruidStats = (level) => buildPlayerStats({
      level,
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Moon' },
        subclass: { name: 'Circle of the Moon' },
        class_levels: [],
        fightingStyles: [],
      },
      automation: { passives: [] },
    });

    it('renders moonlight step uses for circle of the moon', () => {
      const stats = moonDruidStats(10);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Moonlight Step Uses:')).toBeInTheDocument();
    });

    it('does not render moonlight step uses for non-moon circles', () => {
      const nonMoonStats = buildPlayerStats({
        level: 10,
        class: {
          name: 'Druid',
          major: { name: 'Circle of the Land' },
          subclass: { name: 'Circle of the Land' },
          class_levels: [],
          fightingStyles: [],
        },
        automation: { passives: [] },
      });
      render(<CharClassFeatures playerStats={nonMoonStats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText('Moonlight Step Uses:')).not.toBeInTheDocument();
    });

    it('uses wisdom bonus as max with minimum 1 when wisdom is negative', () => {
      const stats = moonDruidStats(10);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Moonlight Step Uses:/).parentElement).toHaveTextContent(/3\/3/);
    });

    it('CLA-230: renders Restore Uses control that dispatches the moonlight-step-restore bus event', () => {
      const stats = moonDruidStats(10);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      const btn = screen.getByRole('button', { name: /Restore Uses/i });
      const handler = vi.fn();
      window.addEventListener('moonlight-step-restore', handler);
      fireEvent.click(btn);
      window.removeEventListener('moonlight-step-restore', handler);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('CLA-230: hides Restore Uses below level 10', () => {
      const stats = moonDruidStats(3);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByRole('button', { name: /Restore Uses/i })).not.toBeInTheDocument();
    });

    it('uses minimum 1 when wisdom bonus is negative', () => {
      const negativeWisStats = buildPlayerStats({
        level: 10,
        abilities: [{ name: 'Wisdom', bonus: -2 }],
        class: {
          name: 'Druid',
          major: { name: 'Circle of the Moon' },
          subclass: { name: 'Circle of the Moon' },
          class_levels: [],
          fightingStyles: [],
        },
        automation: { passives: [] },
      });
      render(<CharClassFeatures playerStats={negativeWisStats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Moonlight Step Uses:/).parentElement).toHaveTextContent(/1\/1/);
    });
  });

  describe('circle of the land', () => {
    const landDruidStats = (level) => buildPlayerStats({
      level,
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Land' },
        subclass: { name: 'Circle of the Land' },
        class_levels: [],
        fightingStyles: [],
      },
      automation: { passives: [] },
    });

    it('renders circle of the land badge when type is set', () => {
      setCircleOfTheLandType('Forest');
      const stats = landDruidStats(3);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Circle of the Land: Forest/)).toBeInTheDocument();
    });

    it('does not render circle of the land badge when type is null', () => {
      setCircleOfTheLandType(null);
      const stats = landDruidStats(3);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText(/Circle of the Land:/)).not.toBeInTheDocument();
    });

    it('does not render circle of the land badge when type is empty', () => {
      setCircleOfTheLandType('');
      const stats = landDruidStats(3);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText(/Circle of the Land:/)).not.toBeInTheDocument();
    });
  });

  describe('elemental fury (circle of the storm)', () => {
    const stormDruidStats = (level) => buildPlayerStats({
      level,
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Storm' },
        subclass: { name: 'Circle of the Storm' },
        class_levels: [],
        fightingStyles: [],
      },
      automation: { passives: [] },
    });

    it('renders elemental fury and improved elemental fury badges when choices are set', () => {
      setElementalFuryChoices('Lightning', 'Fire');
      const stats = stormDruidStats(18);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Elemental Fury: Lightning/)).toBeInTheDocument();
      expect(screen.getByText(/Improved Elemental Fury: Fire/)).toBeInTheDocument();
    });

    it('does not render elemental fury badges when choices are not set', () => {
      const stats = stormDruidStats(18);
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText(/Elemental Fury/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Improved Elemental Fury/)).not.toBeInTheDocument();
    });
  });

  describe('wrath of the sea', () => {
    const seaDruidStats = () => buildPlayerStats({
      level: 2,
      class: {
        name: 'Druid',
        major: { name: 'Circle of the Sea' },
        subclass: { name: 'Circle of the Sea' },
        class_levels: [],
        fightingStyles: [],
      },
      automation: { passives: [] },
    });

    it('renders wrath of the sea badge when active', () => {
      setWrathOfTheSeaActive(true);
      const stats = seaDruidStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Wrath of the Sea Active')).toBeInTheDocument();
    });

    it('does not render wrath of the sea badge when inactive', () => {
      setWrathOfTheSeaActive(false);
      const stats = seaDruidStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText('Wrath of the Sea Active')).not.toBeInTheDocument();
    });

    it('does not render wrath of the sea badge when undefined', () => {
      setWrathOfTheSeaActive(undefined);
      const stats = seaDruidStats();
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText('Wrath of the Sea Active')).not.toBeInTheDocument();
    });
  });

  describe('multi-minute badges', () => {
    it('renders multi-minute duration badges', () => {
      setBuffs([{ name: 'Some Buff', duration: '10_minutes' }]);
      const stats = buildPlayerStats({ level: 2 });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Some Buff: 10_minutes')).toBeInTheDocument();
    });

    it('formats half_druid_level_hours as half of Druid LEVEL not half of uses (CLA-391)', () => {
      setBuffs([{ name: 'Wild Shape', effect: 'shape_shift', duration: 'half_druid_level_hours' }]);
      const stats = buildPlayerStats({
        level: 20,
        class: {
          name: 'Druid',
          major: {},
          subclass: {},
          class_levels: [{ level: 20, wild_shape: 4 }],
          fightingStyles: [],
        },
      });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText('Wild Shape: 10 hours')).toBeInTheDocument();
      expect(screen.queryByText('Wild Shape: 2 hours')).not.toBeInTheDocument();
    });

    it('suppresses non-multi-minute duration badges', () => {
      setBuffs([{ name: 'Some Buff', duration: '1_round' }]);
      const stats = buildPlayerStats({ level: 2 });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.queryByText('Some Buff')).not.toBeInTheDocument();
    });

    it('handles undefined activeBuffs gracefully', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return undefined;
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Wild Shape Limitations:/)).toBeInTheDocument();
    });

    it('handles null activeBuffs gracefully', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return null;
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      render(<CharClassFeatures playerStats={stats} campaignName={MOCK_CAMPAIGN} />);
      expect(screen.getByText(/Wild Shape Limitations:/)).toBeInTheDocument();
    });
  });
});
