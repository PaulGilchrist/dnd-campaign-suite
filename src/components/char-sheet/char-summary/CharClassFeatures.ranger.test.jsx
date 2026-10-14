import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RangerFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

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

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({
    extraAttacks: 1,
  })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([])),
}));

const mockCampaignName = 'test-campaign';

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Ranger',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Ranger',
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

describe('RangerFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      switch (key) {
        case '_Defensive_Tactics_choice': return undefined;
        case "_Hunter's_Prey_choice": return undefined;
        default: return undefined;
      }
    });
  });

  describe('level-gated tracked resources', () => {
    it('renders Dread Ambush when level >= 3', () => {
      const stats = buildPlayerStats({ level: 3 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Dread Ambush:')).toBeInTheDocument();
    });

    it('does not render Dread Ambush when level < 3', () => {
      const stats = buildPlayerStats({ level: 2 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.queryByText('Dread Ambush:')).not.toBeInTheDocument();
    });

    it('renders Favored Enemy when level >= 2', () => {
      const stats = buildPlayerStats({
        level: 2,
        class: {
          name: 'Ranger',
          major: {},
          subclass: {},
          class_levels: [{ level: 2, favored_enemy: 4 }],
          fightingStyles: [],
        },
      });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Favored Enemy:')).toBeInTheDocument();
    });

    it('does not render Favored Enemy when level < 2', () => {
      const stats = buildPlayerStats({ level: 1 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.queryByText('Favored Enemy:')).not.toBeInTheDocument();
    });

    it('renders Nature\'s Veil when level >= 14', () => {
      const stats = buildPlayerStats({ level: 14 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText("Nature's Veil:")).toBeInTheDocument();
    });

    it('does not render Nature\'s Veil when level < 14', () => {
      const stats = buildPlayerStats({ level: 13 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.queryByText("Nature's Veil:")).not.toBeInTheDocument();
    });

    it('renders Tireless when level >= 10', () => {
      const stats = buildPlayerStats({ level: 10 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Tireless:')).toBeInTheDocument();
    });

    it('does not render Tireless when level < 10', () => {
      const stats = buildPlayerStats({ level: 9 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.queryByText('Tireless:')).not.toBeInTheDocument();
    });
  });

  describe('expertise display', () => {
    it('renders expertise list when level > 2 and expertise array has entries', () => {
      const stats = buildPlayerStats({ level: 5, expertise: ['Stealth', 'Survival'] });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
      expect(screen.getByText('Stealth, Survival')).toBeInTheDocument();
    });

    it('does not render expertise when level <= 2, array is empty, or expertise is undefined', () => {
      const negativeCases = [
        { level: 2, expertise: ['Stealth'] },
        { level: 5, expertise: [] },
        { level: 5 },
      ];
      for (const caseStats of negativeCases) {
        const stats = buildPlayerStats(caseStats);
        render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.queryByText(/Expertise:/)).not.toBeInTheDocument();
      }
    });
  });

  describe('fighting styles', () => {
    it('renders fighting styles when present and level > 1', () => {
      const stats = buildPlayerStats({
        level: 2,
        class: {
          name: 'Ranger',
          major: {},
          subclass: {},
          class_levels: [{ level: 2 }],
          fightingStyles: ['Defense'],
        },
      });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
      expect(screen.getByText('Defense')).toBeInTheDocument();
    });

    it('renders multiple fighting styles separated by commas', () => {
      const stats = buildPlayerStats({
        level: 2,
        class: {
          name: 'Ranger',
          major: {},
          subclass: {},
          class_levels: [{ level: 2 }],
          fightingStyles: ['Defense', 'Two-Weapon Fighting'],
        },
      });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
      expect(screen.getByText('Two-Weapon Fighting')).toBeInTheDocument();
    });

    it('does not render fighting styles when level <= 1, fightingStyles is null, or fightingStyles is undefined', () => {
      const negativeCases = [
        { level: 1, class: { name: 'Ranger', major: {}, subclass: {}, class_levels: [{ level: 1 }], fightingStyles: ['Defense'] } },
        { level: 2, class: { name: 'Ranger', major: {}, subclass: {}, class_levels: [{ level: 2 }], fightingStyles: null } },
        { level: 2, class: { name: 'Ranger', major: {}, subclass: {}, class_levels: [{ level: 2 }] } },
      ];
      for (const caseStats of negativeCases) {
        const stats = buildPlayerStats(caseStats);
        render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.queryByText(/Fighting Styles:/)).not.toBeInTheDocument();
      }
    });
  });

  describe('extra attacks', () => {
    it('renders extra attacks value from getClassFeatures', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        extraAttacks: 2,
      });
      const stats = buildPlayerStats({ level: 5 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    });

    it('renders extra attacks as 0 when getClassFeatures returns 0', () => {
      vi.mocked(classFeatures.getClassFeatures).mockReturnValue({
        extraAttacks: 0,
      });
      const stats = buildPlayerStats({ level: 5 });
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    });
  });

  describe('defensive tactics', () => {
    it('renders defensive tactics badge text when choice is set', () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === '_Defensive_Tactics_choice') return 'Evasion';
        return undefined;
      });
      const stats = buildPlayerStats();
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText('Evasion')).toBeInTheDocument();
    });

    it('does not render defensive tactics badge when choice is null or undefined', () => {
      const values = [null, undefined];
      for (const choiceValue of values) {
        runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
          if (key === '_Defensive_Tactics_choice') return choiceValue;
          return undefined;
        });
        const stats = buildPlayerStats();
        render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
        expect(screen.queryByText(/Evasion/)).not.toBeInTheDocument();
      }
    });
  });

  describe("hunter's prey", () => {
    it("renders hunter's prey badge text when choice is set", () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === "_Hunter's_Prey_choice") return 'Marked Target';
        return undefined;
      });
      const stats = buildPlayerStats();
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.getByText("Marked Target")).toBeInTheDocument();
    });

    it("does not render hunter's prey badge when choice is null", () => {
      runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
        if (key === "_Hunter's_Prey_choice") return null;
        return undefined;
      });
      const stats = buildPlayerStats();
      render(<RangerFeatures playerStats={stats} campaignName={mockCampaignName} />);
      expect(screen.queryByText(/Marked Target/)).not.toBeInTheDocument();
    });
  });
});
