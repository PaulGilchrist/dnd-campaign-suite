// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import FighterFeatures from './CharClassFeatures.jsx';
import { loadFightingStyles } from '../../../services/ui/dataLoader.js';

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => null),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn((_name, key) => {
    if (key === '_trackedResources') return {};
    return undefined;
  }),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([])),
}));

vi.mock('./TrackedResourceInput.jsx', () => ({
  default: function MockTrackedResourceInput({ label, getMax }) {
    const max = getMax ? getMax() : 0;
    return (
      <div>
        <b>{label}:</b> <span>{max}/{max}</span>
      </div>
    );
  },
}));

vi.mock('../modals/WeaponKindMasteryModal.jsx', () => ({
  default: function MockWeaponKindMasteryModal() {
    return <div>WeaponKindMasteryModal</div>;
  },
}));

vi.mock('../../common/popup.jsx', () => ({
  default: function MockPopup({ html, onClickOrKeyDown }) {
    return (
      <div onClick={onClickOrKeyDown}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
      </div>
    );
  },
}));

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Fighter',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Fighter',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Strength', bonus: 3 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Charisma', bonus: 1 },
    ],
    automation: {},
    ...overrides,
  };
}

describe('FighterFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('null/missing classLevel', () => {
    it('returns null when class_levels is null', () => {
      const stats = buildPlayerStats({
        class: { name: 'Fighter', major: {}, subclass: {}, class_levels: null, fightingStyles: [] },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toBe('');
    });

    it('returns null when class_levels is empty', () => {
      const stats = buildPlayerStats({
        class: { name: 'Fighter', major: {}, subclass: {}, class_levels: [], fightingStyles: [] },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toBe('');
    });

    it('returns null when level exceeds class_levels length', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: [{ level: 1 }, { level: 2 }],
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toBe('');
    });
  });

  describe('5e ruleset', () => {
    it('renders Action Surge tracked resource', () => {
      const stats = buildPlayerStats({
        level: 2,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: [{ level: 1 }, { level: 2, class_specific: { action_surges: 2 } }],
          fightingStyles: [],
        },
      });
      render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Action Surge Uses:')).toBeInTheDocument();
    });

    it('renders Extra Attacks with value from classLevel for level 5+', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: Array(5).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const statsWithExtra = {
        ...stats,
        class: {
          ...stats.class,
          class_levels: stats.class.class_levels.map((cl, i) =>
            i === 4 ? { level: 5, extra_attacks: 2 } : cl
          ),
        },
      };
      const { container } = render(<FighterFeatures playerStats={statsWithExtra} campaignName="test" />);
      expect(container.textContent).toContain('Extra Attacks: 2');
    });

    it('renders Extra Attacks as 0 when classLevel lacks extra_attacks', () => {
      const stats = buildPlayerStats({
        level: 3,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Extra Attacks: 0');
    });

    it('renders Second Wind tracked resource', () => {
      const stats = buildPlayerStats({
        level: 1,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: [{ level: 1, second_wind: 1 }],
          fightingStyles: [],
        },
      });
      render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Second Wind:')).toBeInTheDocument();
    });

    it('renders Weapon Mastery from classLevel with clickable styling', () => {
      const stats = buildPlayerStats({
        level: 1,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: [{ level: 1, weapon_mastery: 'Piercing' }],
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Weapon Mastery: Piercing');
      const masteryLabel = screen.getByText(/Weapon Mastery:/);
      expect(masteryLabel.nextElementSibling).toHaveClass('clickable');
    });
  });

  describe('2024 ruleset', () => {
    it('renders Action Surge as 0/0 for level 1', () => {
      const stats = buildPlayerStats({
        level: 1,
        rules: '2024',
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: [{ level: 1 }],
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('0/0');
    });

    it('renders Action Surge as 1/1 for level 2-16', () => {
      const stats = buildPlayerStats({
        level: 5,
        rules: '2024',
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: Array(5).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('1/1');
    });

    it('renders Action Surge as 2/2 for level 17+', () => {
      const stats = buildPlayerStats({
        level: 17,
        rules: '2024',
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: Array(17).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('2/2');
    });

    it('renders Weapon Mastery from classLevel for 2024', () => {
      const stats = buildPlayerStats({
        level: 5,
        rules: '2024',
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: Array(5).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const statsWithMastery = {
        ...stats,
        class: {
          ...stats.class,
          class_levels: stats.class.class_levels.map((cl, i) =>
            i === 4 ? { level: 5, weapon_mastery: 'Slashing' } : cl
          ),
        },
      };
      const { container } = render(<FighterFeatures playerStats={statsWithMastery} campaignName="test" />);
      expect(container.textContent).toContain('Weapon Mastery: Slashing');
    });
  });

  describe('energy system', () => {
    it('renders energy dice when energy required_major matches major name', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Fighter',
          major: { name: 'Psi Warrior' },
          subclass: {},
          class_levels: Array(5).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const statsWithEnergy = {
        ...stats,
        class: {
          ...stats.class,
          class_levels: stats.class.class_levels.map((cl, i) =>
            i === 4 ? { level: 5, energy: { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 6 } } : cl
          ),
        },
      };
      const { container } = render(<FighterFeatures playerStats={statsWithEnergy} campaignName="test" />);
      expect(container.textContent).toContain('Energy Dice');
      expect(container.textContent).toContain('Energy Die Type: d6');
    });

    it('does not render energy dice when energy required_major does not match major name', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Fighter',
          major: { name: 'Battle Master' },
          subclass: {},
          class_levels: Array(5).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const statsWithEnergy = {
        ...stats,
        class: {
          ...stats.class,
          class_levels: stats.class.class_levels.map((cl, i) =>
            i === 4 ? { level: 5, energy: { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 6 } } : cl
          ),
        },
      };
      const { container } = render(<FighterFeatures playerStats={statsWithEnergy} campaignName="test" />);
      expect(container.textContent).not.toContain('Energy Dice');
      expect(container.textContent).not.toContain('Energy Die Type');
    });

    it('does not render energy dice when energy is missing from classLevel', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Fighter',
          major: { name: 'Psi Warrior' },
          subclass: {},
          class_levels: Array(5).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).not.toContain('Energy Dice');
    });
  });

  describe('fighting styles', () => {
    it('renders fighting styles when present', () => {
      const stats = buildPlayerStats({
        level: 2,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: [null, { level: 2 }],
          fightingStyles: ['Defense', 'Great Weapon Fighting'],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Fighting Styles:');
      expect(container.textContent).toContain('Defense');
      expect(container.textContent).toContain('Great Weapon Fighting');
    });

    it('renders N/A when fightingStyles is null', () => {
      const stats = buildPlayerStats({
        level: 1,
        class: { name: 'Fighter', major: {}, subclass: {}, class_levels: [{ level: 1 }], fightingStyles: null },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Fighting Styles: N/A');
    });

    it('renders empty string when fightingStyles is empty array', () => {
      const stats = buildPlayerStats({
        level: 1,
        class: { name: 'Fighter', major: {}, subclass: {}, class_levels: [{ level: 1 }], fightingStyles: [] },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Fighting Styles:');
      expect(container.textContent).not.toContain('N/A');
    });

    describe('badge popup (bug-CLA-005 collateral)', () => {
      afterEach(() => {
        vi.mocked(loadFightingStyles).mockResolvedValue([]);
      });

      const badgeStats = () => buildPlayerStats({
        level: 18,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: Array(18).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: ['Unarmed Fighting', 'Interception'],
        },
      });

      it('clicking a fighting style badge renders the popup without throwing', async () => {
        vi.mocked(loadFightingStyles).mockResolvedValue([
          { name: 'Unarmed Fighting', description: 'UNARMED_POPUP_DESC' },
          { name: 'Interception', description: 'INTERCEPTION_POPUP_DESC' },
        ]);
        const { container } = render(<FighterFeatures playerStats={badgeStats()} campaignName="test" />);
        await act(async () => {});
        const badge = [...container.querySelectorAll('span.clickable')].find(s => s.textContent === 'Unarmed Fighting');
        fireEvent.click(badge);
        expect(screen.getByText('UNARMED_POPUP_DESC')).toBeInTheDocument();
        expect(screen.getByText('Interception')).toBeInTheDocument();
      });

      it('clicking the added style badge opens its own popup and dismisses', async () => {
        vi.mocked(loadFightingStyles).mockResolvedValue([
          { name: 'Unarmed Fighting', description: 'UNARMED_POPUP_DESC' },
          { name: 'Interception', description: 'INTERCEPTION_POPUP_DESC' },
        ]);
        const { container } = render(<FighterFeatures playerStats={badgeStats()} campaignName="test" />);
        await act(async () => {});
        const badge = [...container.querySelectorAll('span.clickable')].find(s => s.textContent === 'Interception');
        fireEvent.click(badge);
        expect(screen.getByText('INTERCEPTION_POPUP_DESC')).toBeInTheDocument();
        fireEvent.click(screen.getByText('INTERCEPTION_POPUP_DESC'));
        expect(screen.queryByText('INTERCEPTION_POPUP_DESC')).not.toBeInTheDocument();
      });
    });
  });

  describe('superiority dice', () => {
    it('renders superiority dice tracked resource for Battle Master', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Fighter',
          major: { name: 'Battle Master' },
          subclass: {},
          class_levels: Array(5).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Superiority Dice:')).toBeInTheDocument();
    });

    it('does not render superiority dice for non-superiority fighter', () => {
      const stats = buildPlayerStats({
        level: 5,
        class: {
          name: 'Fighter',
          major: {},
          subclass: {},
          class_levels: Array(5).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: ['Defense'],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).not.toContain('Superiority Dice');
      expect(container.textContent).not.toContain('Superiority Die');
    });

    it('shows superiority die type d12 for level 18+ Battle Master', () => {
      const stats = buildPlayerStats({
        level: 18,
        class: {
          name: 'Fighter',
          major: { name: 'Battle Master' },
          subclass: {},
          class_levels: Array(18).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Superiority Die: d12');
    });

    it('shows superiority die type d10 for level 10-17 Battle Master', () => {
      const stats = buildPlayerStats({
        level: 10,
        class: {
          name: 'Fighter',
          major: { name: 'Battle Master' },
          subclass: {},
          class_levels: Array(10).fill(null).map((_, i) => ({ level: i + 1 })),
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Superiority Die: d10');
    });

    it('shows superiority die type d8 for level 2-9 Battle Master', () => {
      const stats = buildPlayerStats({
        level: 2,
        class: {
          name: 'Fighter',
          major: { name: 'Battle Master' },
          subclass: {},
          class_levels: [null, { level: 2 }],
          fightingStyles: [],
        },
      });
      const { container } = render(<FighterFeatures playerStats={stats} campaignName="test" />);
      expect(container.textContent).toContain('Superiority Die: d8');
    });
  });
});
