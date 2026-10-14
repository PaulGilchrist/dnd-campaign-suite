import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PaladinFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as gloriousDefense from '../../../services/automation/handlers/class-cleric-paladin/gloriousDefenseHandler.js';
import * as auraOfProtection from '../../../services/combat/auras/auraOfProtection.js';

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({
    maxChannelDivinity: 2,
    auraRange: null,
    extraAttacks: 1,
  })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/class-cleric-paladin/gloriousDefenseHandler.js', () => ({
  hasGloriousDefenseActive: vi.fn(() => false),
  handle: vi.fn(),
}));

vi.mock('../../../services/combat/auras/auraOfProtection.js', () => ({
  getAuraRangeFromStats: vi.fn(() => 10),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([])),
}));

vi.mock('./TrackedResourceInput.jsx', () => {
  return {
    default: function MockTrackedResourceInput({ label, getMax, resourceKey: _resourceKey }) {
      const max = getMax ? getMax() : 0;
      return (
        <div>
          <b>{label}:</b> <span>{max}/{max}</span>
        </div>
      );
    },
  };
});

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Paladin',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Paladin',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Charisma', bonus: 3 },
    ],
    automation: {},
    ...overrides,
  };
}

describe('PaladinFeatures', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      switch (key) {
        case 'activeBuffs': return [];
        default: return undefined;
      }
    });
  });

  describe('aura of protection', () => {
    it('renders locked aura at level < 6 with cha bonus', () => {
      const stats = buildPlayerStats({ level: 5 });
      const { container } = render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Aura of Protection:/)).toBeInTheDocument();
      expect(screen.getByText(/to saves/)).toBeInTheDocument();
      expect(container.textContent).toContain('+3');
      expect(container.textContent).toContain('(locked)');
    });

    it('renders unlocked aura with range at level >= 6', () => {
      auraOfProtection.getAuraRangeFromStats.mockReturnValue(30);
      const stats = buildPlayerStats({ level: 6 });
      const { container } = render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Aura of Protection:/)).toBeInTheDocument();
      expect(screen.getByText(/to saves/)).toBeInTheDocument();
      expect(container.textContent).toContain('+3');
      expect(container.textContent).toContain('(30 ft.)');
    });

    it('does not render aura of protection when charisma cannot be found (missing ability, null abilities)', () => {
      const statsNoCha = buildPlayerStats({
        level: 5,
        abilities: [{ name: 'Strength', bonus: 3 }],
      });
      render(<PaladinFeatures playerStats={statsNoCha} campaignName="test" />);
      expect(screen.queryByText(/Aura of Protection/)).toBeNull();

      const statsNullAbilities = buildPlayerStats({ abilities: null });
      render(<PaladinFeatures playerStats={statsNullAbilities} campaignName="test" />);
      expect(screen.queryByText(/Aura of Protection/)).toBeNull();
    });
  });

  describe('aura range feature', () => {
    it('renders aura range line when getClassFeatures returns a numeric value', () => {
      classFeatures.getClassFeatures.mockReturnValue({
        maxChannelDivinity: 2,
        auraRange: 10,
        extraAttacks: 1,
      });
      const stats = buildPlayerStats({ level: 5 });
      const { container } = render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Aura Range:/)).toBeInTheDocument();
      expect(container.textContent).toContain('Aura Range: 10');
    });

    it('does not render aura range line when getClassFeatures returns null', () => {
      classFeatures.getClassFeatures.mockReturnValue({
        maxChannelDivinity: 2,
        auraRange: null,
        extraAttacks: 1,
      });
      const stats = buildPlayerStats({ level: 5 });
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Aura Range:/)).toBeNull();
    });
  });

  describe('channel divinity charges', () => {
    it('renders the tracked resource with max from class features (defaults to 0 when missing)', () => {
      const stats = buildPlayerStats({ level: 5 });
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Channel Divinity Charges:')).toBeInTheDocument();
      expect(screen.getByText('2/2')).toBeInTheDocument();
    });

    it('uses 0 when maxChannelDivinity is missing from class features', () => {
      classFeatures.getClassFeatures.mockReturnValue({});
      const stats = buildPlayerStats({ level: 5 });
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Channel Divinity Charges:')).toBeInTheDocument();
      expect(screen.getByText('0/0')).toBeInTheDocument();
    });
  });

  describe('extra attacks', () => {
    it('renders extra attacks from class features', () => {
      classFeatures.getClassFeatures.mockReturnValue({
        maxChannelDivinity: 2,
        auraRange: null,
        extraAttacks: 1,
      });
      const stats = buildPlayerStats({ level: 5 });
      const { container } = render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
      expect(container.textContent).toContain('Extra Attacks: 1');
    });
  });

  describe('fighting styles', () => {
    it('renders fighting styles section when present', () => {
      const stats = buildPlayerStats({
        level: 2,
        class: {
          name: 'Paladin',
          major: {},
          subclass: {},
          class_levels: [{ level: 2 }],
          fightingStyles: ['Defense', 'Great Weapon Fighting'],
        },
      });
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
      expect(screen.getByText('Defense')).toBeInTheDocument();
      expect(screen.getByText('Great Weapon Fighting')).toBeInTheDocument();
    });

    it('does not render fighting styles when null or undefined, renders with empty array', () => {
      const statsNull = buildPlayerStats({
        level: 1,
        class: {
          name: 'Paladin',
          major: {},
          subclass: {},
          class_levels: [{ level: 1 }],
          fightingStyles: null,
        },
      });
      render(<PaladinFeatures playerStats={statsNull} campaignName="test" />);
      expect(screen.queryByText(/Fighting Styles/)).toBeNull();

      const statsUndefined = buildPlayerStats({
        level: 1,
        class: {
          name: 'Paladin',
          major: {},
          subclass: {},
          class_levels: [{ level: 1 }],
        },
      });
      render(<PaladinFeatures playerStats={statsUndefined} campaignName="test" />);
      expect(screen.queryByText(/Fighting Styles/)).toBeNull();

      const statsEmpty = buildPlayerStats({
        level: 1,
        class: {
          name: 'Paladin',
          major: {},
          subclass: {},
          class_levels: [{ level: 1 }],
          fightingStyles: [],
        },
      });
      render(<PaladinFeatures playerStats={statsEmpty} campaignName="test" />);
      expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
    });
  });

  describe('lay on hands pool', () => {
    it('renders the tracked resource with max = 5 * level', () => {
      render(<PaladinFeatures playerStats={buildPlayerStats({ level: 1 })} campaignName="test" />);
      expect(screen.getByText('Lay On Hands Pool:')).toBeInTheDocument();
      expect(screen.getByText('5/5')).toBeInTheDocument();

      render(<PaladinFeatures playerStats={buildPlayerStats({ level: 5 })} campaignName="test" />);
      expect(screen.getByText('25/25')).toBeInTheDocument();

      render(<PaladinFeatures playerStats={buildPlayerStats({ level: 20 })} campaignName="test" />);
      expect(screen.getByText('100/100')).toBeInTheDocument();
    });
  });

  describe('glorious defense', () => {
    it('renders tracked resource when feature is active', () => {
      gloriousDefense.hasGloriousDefenseActive.mockReturnValue(true);
      const stats = buildPlayerStats({ level: 5 });
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Glorious Defense Uses:')).toBeInTheDocument();
    });

    it('does not render tracked resource when feature is inactive', () => {
      gloriousDefense.hasGloriousDefenseActive.mockReturnValue(false);
      const stats = buildPlayerStats({ level: 5 });
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Glorious Defense/)).toBeNull();
    });

    it('uses cha bonus as max with minimum of 1', () => {
      gloriousDefense.hasGloriousDefenseActive.mockReturnValue(true);
      const stats = buildPlayerStats({
        level: 5,
        abilities: [{ name: 'Charisma', bonus: 0 }],
      });
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('1/1')).toBeInTheDocument();

      gloriousDefense.hasGloriousDefenseActive.mockReturnValue(true);
      const statsHigh = buildPlayerStats({
        level: 5,
        abilities: [{ name: 'Charisma', bonus: 5 }],
      });
      render(<PaladinFeatures playerStats={statsHigh} campaignName="test" />);
      expect(screen.getByText('5/5')).toBeInTheDocument();
    });
  });

  describe('active buff badges', () => {
    const badgeTests = [
      { key: 'holyNimbusActive', name: 'Holy Nimbus' },
      { key: 'livingLegendActive', name: 'Living Legend' },
      { key: 'peerlessAthleteActive', name: 'Peerless Athlete' },
      { key: 'elderChampionActive', name: 'Elder Champion' },
      { key: 'avengingAngelActive', name: 'Avenging Angel' },
    ];

    it.each(badgeTests)('shows $name badge when active', ({ key, name }) => {
      runtimeState.useRuntimeValue.mockImplementation((_name, testKey) => {
        if (testKey === key) return true;
        if (testKey === 'activeBuffs') return [];
        return undefined;
      });
      const stats = buildPlayerStats();
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(name)).toBeInTheDocument();
    });

    it.each(badgeTests)('does not show $name badge when inactive', ({ key, name }) => {
      runtimeState.useRuntimeValue.mockImplementation((_name, testKey) => {
        if (testKey === key) return false;
        if (testKey === 'activeBuffs') return [];
        return undefined;
      });
      const stats = buildPlayerStats();
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(name)).toBeNull();
    });

    it('shows all active buff badges simultaneously', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        const activeStates = {
          holyNimbusActive: true,
          livingLegendActive: true,
          peerlessAthleteActive: true,
          elderChampionActive: true,
          avengingAngelActive: true,
        };
        if (activeStates[key] !== undefined) return activeStates[key];
        if (key === 'activeBuffs') return [];
        return undefined;
      });
      const stats = buildPlayerStats();
      render(<PaladinFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Holy Nimbus')).toBeInTheDocument();
      expect(screen.getByText('Living Legend')).toBeInTheDocument();
      expect(screen.getByText('Peerless Athlete')).toBeInTheDocument();
      expect(screen.getByText('Elder Champion')).toBeInTheDocument();
      expect(screen.getByText('Avenging Angel')).toBeInTheDocument();
    });
  });
});
