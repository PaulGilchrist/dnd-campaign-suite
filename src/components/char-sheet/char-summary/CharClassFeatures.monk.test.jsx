import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonkFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./TrackedResourceInput.jsx', () => ({
  default: function MockTrackedResourceInput({ label, getMax }) {
    const max = getMax ? getMax() : 0;
    return (
      <div>
        <b>{label}:</b> 0/{max} <span className="text-muted">(cur/max)</span>
      </div>
    );
  },
}));

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Monk',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Monk',
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

describe('MonkFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
      martialArtsDie: 4,
      unarmoredMovementIncrease: 0,
      maxFocusPoints: 5,
    });
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      switch (key) {
        case 'activeBuffs': return [];
        case 'elementalAttunementActive': return undefined;
        case 'elementalAttunementElement': return undefined;
        case 'elementalEpitomeActive': return undefined;
        case 'epitomeResistanceType': return undefined;
        case 'destructiveStrideActive': return undefined;
        default: return undefined;
      }
    });
  });

  describe('level gating', () => {
    it('renders features for level 2', () => {
      const stats = buildPlayerStats({ level: 2 });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Extra Attacks: 0');
    });
  });

  describe('class-level dependent features', () => {
    it('renders extra attacks based on class_level data', () => {
      const extraAttacksCases = [
        {
          level: 5,
          class_levels: [null, null, null, null, { level: 5, extra_attacks: 2 }],
          expected: 'Extra Attacks: 2',
        },
        {
          level: 5,
          class_levels: [null, null, null, null, null],
          expected: 'Extra Attacks: 0',
        },
        {
          level: 10,
          class_levels: [null, { level: 2 }],
          expected: 'Extra Attacks: 0',
        },
        {
          level: 6,
          class_levels: [null, null, null, null, null, { level: 6 }],
          expected: 'Extra Attacks: 0',
        },
      ];
      for (const { level, class_levels, expected } of extraAttacksCases) {
        const stats = buildPlayerStats({
          level,
          class: {
            name: 'Monk',
            major: {},
            subclass: {},
            class_levels,
            fightingStyles: [],
          },
        });
        const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
        expect(container.textContent).toContain(expected);
      }
    });

    it('renders focus points tracked resource', () => {
      const stats = buildPlayerStats({ level: 2 });
      render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Focus Points:/)).toBeInTheDocument();
    });

    it.each`
      wisdomBonus | proficiency | expectedDC
      ${3}        | ${2}        | ${13}
      ${0}        | ${2}        | ${10}
      ${3}        | ${0}        | ${11}
      ${0}        | ${0}        | ${8}
    `('calculates focus save DC as 8 + wisdom bonus + proficiency ($wisdomBonus + $proficiency = $expectedDC)', ({ wisdomBonus, proficiency, expectedDC }) => {
      const stats = buildPlayerStats({
        level: 2,
        abilities: [{ name: 'Wisdom', bonus: wisdomBonus }],
        proficiency,
      });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain(`Focus Save DC: ${expectedDC}`);
    });

    it.each`
      martialArtsDie | expectedText
      ${4}           | ${'Martial Arts Die: d4'}
      ${6}           | ${'Martial Arts Die: d6'}
      ${8}           | ${'Martial Arts Die: d8'}
    `('renders martial arts die as $expectedText when classFeatures returns $martialArtsDie', ({ martialArtsDie, expectedText }) => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        martialArtsDie,
        unarmoredMovementIncrease: 0,
        maxFocusPoints: 5,
      });
      const stats = buildPlayerStats({ level: 2 });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain(expectedText);
    });

    it.each`
      movement | expectedText
      ${0}     | ${'Unarmored Movement: +0 ft.'}
      ${10}    | ${'Unarmored Movement: +10 ft.'}
      ${15}    | ${'Unarmored Movement: +15 ft.'}
      ${25}    | ${'Unarmored Movement: +25 ft.'}
    `('renders unarmored movement as $expectedText when classFeatures returns $movement', ({ movement, expectedText }) => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        martialArtsDie: 4,
        unarmoredMovementIncrease: movement,
        maxFocusPoints: 5,
      });
      const stats = buildPlayerStats({ level: 2 });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain(expectedText);
    });
  });

  describe('active buffs display', () => {
    it('shows cloak of shadows badge when active', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'cloak_of_shadows' }];
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Cloak of Shadows')).toBeInTheDocument();
    });

    it('renders elemental attunement badge with element when active', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'elementalAttunementActive') return true;
        if (key === 'elementalAttunementElement') return 'Fire';
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Elemental Attunement: Fire')).toBeInTheDocument();
    });

    it.each`
      effect                           | expected
      ${'fly_speed_equals_walk_speed'} | ${'Fly Speed'}
      ${'ice_walk'}                    | ${'Ice Walk'}
      ${'speed_boost'}                 | ${'+10 Speed'}
      ${'teleport_ready'}              | ${'Teleport 30 ft'}
    `('renders stride with mapped label "$expected" for effect "$effect"', ({ effect, expected }) => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Stride of the Elements', effect }];
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain(expected);
    });

    it('renders stride with generic label for unknown effect', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Stride of the Elements', effect: 'unknown_effect' }];
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Stride');
    });

    it('renders elemental epitome resistance when active with type', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'elementalEpitomeActive') return true;
        if (key === 'epitomeResistanceType') return 'Fire';
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Resistance to Fire');
    });

    it.each`
      epitomeResistanceType | expected
      ${''}                 | ${'Resistance to'}
    `('renders elemental epitome with empty resistance type', ({ epitomeResistanceType, expected }) => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'elementalEpitomeActive') return true;
        if (key === 'epitomeResistanceType') return epitomeResistanceType;
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain(expected);
    });

    it('renders destructive stride when active', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'destructiveStrideActive') return true;
        return undefined;
      });
      const stats = buildPlayerStats({ level: 2 });
      const { container } = render(<MonkFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Destructive Stride');
    });
  });
});
