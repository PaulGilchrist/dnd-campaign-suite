import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharClassFeatures from './CharClassFeatures.jsx';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => undefined),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./TrackedResourceInput.jsx', () => ({
  default: function MockTrackedResourceInput({ label }) {
    return <div data-testid={`tracked-resource-${label}`}>{label}</div>;
  },
}));

const mockCampaignName = 'test-campaign';

const basePlayerStats = {
  name: 'Thorin',
  level: 5,
  abilities: [
    { name: 'Charisma', bonus: 3 },
    { name: 'Wisdom', bonus: 2 },
    { name: 'Strength', bonus: 4 },
  ],
  proficiency: 3,
  class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, fightingStyles: [] },
  automation: { passives: [], specialActions: [] },
  equipment: [],
  inventory: { equipped: [] },
  spellAbilities: {},
};

function buildPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function renderComponent(playerStats, campaign = mockCampaignName) {
  return render(<CharClassFeatures playerStats={playerStats} campaignName={campaign} />);
}

describe('CharClassFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.useRuntimeValue.mockImplementation((_name, key) => {
      switch (key) {
        case 'activeBuffs': return [];
        default: return undefined;
      }
    });
  });

  describe('unknown class handling', () => {
    it('renders nothing when class is unknown and no adrenaline rush', () => {
      const { container } = renderComponent(buildPlayerStats({ class: { name: 'UnknownClass' } }));
      expect(container.querySelector('*')).toBeNull();
    });

    it('renders adrenaline rush tracked resource when class is unknown but adrenaline rush exists', () => {
      const playerStats = buildPlayerStats({
        class: { name: 'UnknownClass' },
        automation: { ...basePlayerStats.automation, specialActions: [{ effect: 'bonus_action_dash' }] },
      });
      renderComponent(playerStats);
      expect(screen.getByText('Adrenaline Rush')).toBeInTheDocument();
    });

    it('renders stonecunning tracked resource when class is unknown but stonecunning exists', () => {
      const playerStats = buildPlayerStats({
        class: { name: 'UnknownClass' },
        race: { traits: [{ name: 'Stonecunning', automation: true }] },
      });
      renderComponent(playerStats);
      expect(screen.getByText('Stonecunning')).toBeInTheDocument();
    });
  });
});
