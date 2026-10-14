import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WizardFeatures from './CharClassFeatures.jsx';
import * as classFeatures from '../../../services/character/classFeatures.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

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

function buildPlayerStats(overrides = {}) {
  return {
    name: 'Test Wizard',
    level: 1,
    rules: '5e',
    proficiency: 2,
    class: {
      name: 'Wizard',
      major: {},
      subclass: {},
      class_levels: [],
      fightingStyles: [],
    },
    abilities: [
      { name: 'Intelligence', bonus: 3 },
    ],
    automation: {},
    specialActions: [],
    ...overrides,
  };
}

describe('WizardFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classFeatures.getClassFeatures.mockReturnValue({
      arcaneRecoveryLevels: 1,
      showWizardFeatures: true,
    });
    runtimeState.useRuntimeValue.mockReturnValue(undefined);
  });

  describe('arcane recovery', () => {
    it('renders arcane recovery tracked resource at level 5', () => {
      const stats = buildPlayerStats({ level: 5 });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Arcane Recovery Levels:')).toBeInTheDocument();
      expect(screen.getByText('1/1')).toBeInTheDocument();
    });
  });

  describe('arcane ward', () => {
    it('renders arcane ward tracked resource when passive exists', () => {
      const stats = buildPlayerStats({
        level: 5,
        automation: { passives: [{ type: 'arcane_ward' }] },
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Arcane Ward HP:')).toBeInTheDocument();
    });

    it('does not render arcane ward when no matching passive exists', () => {
      const stats = buildPlayerStats({
        level: 5,
        automation: { passives: [{ type: 'something_else' }] },
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText('Arcane Ward HP:')).not.toBeInTheDocument();
    });

    it('calculates ward max as 2 * level + intelligence bonus', () => {
      const stats = buildPlayerStats({
        level: 5,
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        automation: { passives: [{ type: 'arcane_ward' }] },
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('13/13')).toBeInTheDocument();
    });
  });

  describe('portent', () => {
    it('renders portent dice section when specialAction has portent automation type', () => {
      const stats = buildPlayerStats({
        specialActions: [{ automation: { type: 'portent' } }],
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Portent Dice:')).toBeInTheDocument();
    });

    it('does not render portent dice section when missing', () => {
      const stats = buildPlayerStats({ specialActions: [] });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText('Portent Dice:')).not.toBeInTheDocument();
    });

    it('renders each parsed portent die value', () => {
      runtimeState.useRuntimeValue.mockImplementation((_, key) => {
        if (key === 'portentDice') return [12, 7, 19];
        return undefined;
      });
      const stats = buildPlayerStats({
        specialActions: [{ automation: { type: 'portent' } }],
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/12/)).toBeInTheDocument();
      expect(screen.getByText(/7/)).toBeInTheDocument();
      expect(screen.getByText(/19/)).toBeInTheDocument();
    });

    it('renders parsed values from string JSON portent dice without throwing', () => {
      runtimeState.useRuntimeValue.mockImplementation((_, key) => {
        if (key === 'portentDice') return '[15, 3]';
        return undefined;
      });
      const stats = buildPlayerStats({
        specialActions: [{ automation: { type: 'portent' } }],
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Portent Dice:')).toBeInTheDocument();
      expect(screen.getByText(/15/)).toBeInTheDocument();
      expect(screen.getByText(/3/)).toBeInTheDocument();
      expect(screen.getByText('2 remaining (refreshes on Long Rest)')).toBeInTheDocument();
    });

    it('shows no dice remaining when array is empty', () => {
      runtimeState.useRuntimeValue.mockImplementation((_, key) => {
        if (key === 'portentDice') return [];
        return undefined;
      });
      const stats = buildPlayerStats({
        specialActions: [{ automation: { type: 'portent' } }],
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText('No dice remaining')).toBeInTheDocument();
    });

    it('handles invalid JSON, null, and undefined portentDice gracefully', () => {
      const stats = buildPlayerStats({
        specialActions: [{ automation: { type: 'portent' } }],
      });
      ['not json', null, undefined].forEach((value) => {
        runtimeState.useRuntimeValue.mockImplementation((_, key) => {
          if (key === 'portentDice') return value;
          return undefined;
        });
        render(<WizardFeatures playerStats={stats} campaignName="test" />);
        expect(screen.queryAllByText('No dice remaining').length).toBeGreaterThan(0);
      });
    });
  });

  describe('projected ward', () => {
    it('renders projected ward badge when reaction has type projected_ward', () => {
      const stats = buildPlayerStats({
        automation: { reactions: [{ type: 'projected_ward', range: 30 }] },
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Projected Ward: Allies within 30 ft/)).toBeInTheDocument();
    });

    it('renders projected ward badge with custom range', () => {
      const stats = buildPlayerStats({
        automation: { reactions: [{ type: 'projected_ward', range: 60 }] },
      });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Projected Ward: Allies within 60 ft/)).toBeInTheDocument();
    });

    it('does not render projected ward when reactions are missing or empty', () => {
      render(<WizardFeatures playerStats={buildPlayerStats()} campaignName="test" />);
      expect(screen.queryByText(/Projected Ward/)).not.toBeInTheDocument();
      const stats = buildPlayerStats({ automation: { reactions: [] } });
      render(<WizardFeatures playerStats={stats} campaignName="test" />);
      expect(screen.queryByText(/Projected Ward/)).not.toBeInTheDocument();
    });
  });

  describe('the third eye', () => {
    it('renders known third eye effects', () => {
      const effects = [
        { effect: 'darkvision_120', expected: 'Darkvision 120 ft.' },
        { effect: 'greater_comprehension', expected: 'Greater Comprehension' },
        { effect: 'see_invisibility', expected: 'See Invisibility' },
      ];
      effects.forEach(({ effect, expected }) => {
        runtimeState.useRuntimeValue.mockImplementation((_, key) => {
          if (key === 'activeBuffs') return [{ name: 'The Third Eye', effect }];
          return undefined;
        });
        render(<WizardFeatures playerStats={buildPlayerStats()} campaignName="test" />);
        expect(screen.getByText(`The Third Eye: ${expected}`)).toBeInTheDocument();
      });
    });

    it('does not render third eye when activeBuffs is empty or no matching buff', () => {
      runtimeState.useRuntimeValue.mockImplementation((_, key) => {
        if (key === 'activeBuffs') return [{ name: 'Some Other Buff' }];
        return undefined;
      });
      render(<WizardFeatures playerStats={buildPlayerStats()} campaignName="test" />);
      expect(screen.queryByText(/The Third Eye/)).not.toBeInTheDocument();
    });
  });

  describe('show wizard features toggle', () => {
    it('returns null when showWizardFeatures is false', () => {
      classFeatures.getClassFeatures.mockReturnValue({
        arcaneRecoveryLevels: 1,
        showWizardFeatures: false,
      });
      render(<WizardFeatures playerStats={buildPlayerStats()} campaignName="test" />);
      expect(screen.queryByTestId('char-class-wizard')).not.toBeInTheDocument();
    });

    it('renders wizard features when showWizardFeatures is true', () => {
      classFeatures.getClassFeatures.mockReturnValue({
        arcaneRecoveryLevels: 1,
        showWizardFeatures: true,
      });
      render(<WizardFeatures playerStats={buildPlayerStats()} campaignName="test" />);
      expect(screen.getByTestId('char-class-wizard')).toBeInTheDocument();
    });
  });
});
