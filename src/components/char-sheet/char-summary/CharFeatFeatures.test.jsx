import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CharFeatFeatures from './CharFeatFeatures.jsx';

const stores = new Map();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn((_characterKey, key, _campaignName) => {
    const store = stores.get('TestCharacter');
    return store?.has(key) ? store.get(key) : 0;
  }),
}));

vi.mock('./TrackedResourceInput.jsx', () => {
  const Mock = (props) => {
    const max = props.getMax ? props.getMax() : 0;
    const label = props.label || '';
    return React.createElement(
      'div',
      null,
      `${label}: ${max}`,
    );
  };
  return { default: Mock };
});

const basePlayerStats = {
  name: 'TestCharacter',
  proficiency: 3,
  feats: [],
  automation: {
    specialActions: [],
    passives: [],
  },
};

const defaultProps = {
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
};

function setStore(key, value) {
  if (!stores.has('TestCharacter')) stores.set('TestCharacter', new Map());
  const store = stores.get('TestCharacter');
  if (value === null || value === undefined) {
    store.delete(key);
  } else {
    store.set(key, value);
  }
}

function clearStore() {
  stores.clear();
}

describe('CharFeatFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStore();
  });

  describe('null rendering when no features are active', () => {
    it('returns null when automation is undefined', () => {
      const stats = { ...basePlayerStats, automation: undefined };
      const { container } = render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(container.querySelector('div')).toBeNull();
    });

    it('does not render when lucky feat exists but proficiency is 0', () => {
      const stats = { ...basePlayerStats, feats: ['Lucky'], proficiency: 0 };
      setStore('luckyPoints', 5);
      const { container } = render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(container.querySelector('div')).toBeNull();
    });
  });

  describe('lucky feat — rendering', () => {
    it('renders Luck Points input when luckyPoints value is 0 (lpMax drives visibility, not the value)', () => {
      const stats = { ...basePlayerStats, feats: ['Lucky'] };
      setStore('luckyPoints', 0);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.getByText('Luck Points: 3')).toBeInTheDocument();
    });
  });

  describe('poisoner feat — detection and rendering', () => {
    it('renders Poison Doses input when poisoner is detected via matching special action', () => {
      const stats = {
        ...basePlayerStats,
        automation: {
          ...basePlayerStats.automation,
          specialActions: [{ type: 'brew_poison', name: 'Brew Poison' }],
        },
      };
      setStore('poisonDoses', 2);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.getByText('Poison Doses: 3')).toBeInTheDocument();
    });

    it('does not render when poisoner feat is absent', () => {
      const stats = { ...basePlayerStats };
      setStore('poisonDoses', 5);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Poison Doses/)).not.toBeInTheDocument();
    });
  });

  describe('poisoned weapons badge', () => {
    it('renders the poisoned weapons active badge when poisonedWeaponsActive is true', () => {
      const stats = {
        ...basePlayerStats,
        automation: {
          ...basePlayerStats.automation,
          specialActions: [{ type: 'brew_poison', name: 'Brew Poison' }],
        },
      };
      setStore('poisonDoses', 2);
      setStore('poisonedWeaponsActive', true);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      const badge = screen.getByText('Poisoned Weapons active');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('span')).toHaveClass('automation-badge');
      expect(badge.querySelector('i.fa-solid.fa-vial')).toBeInTheDocument();
    });

    it('omits the poisoned weapons badge when poisonedWeaponsActive is false', () => {
      const stats = {
        ...basePlayerStats,
        automation: {
          ...basePlayerStats.automation,
          specialActions: [{ type: 'brew_poison', name: 'Brew Poison' }],
        },
      };
      setStore('poisonDoses', 2);
      setStore('poisonedWeaponsActive', false);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.queryByText('Poisoned Weapons active')).not.toBeInTheDocument();
    });
  });

  describe('chef feat — detection and rendering', () => {
    it('renders Bolstering Treats input when chef is detected via matching special action', () => {
      const stats = {
        ...basePlayerStats,
        automation: {
          ...basePlayerStats.automation,
          specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }],
        },
      };
      setStore('chefBolsteringTreats', 2);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.getByText('Bolstering Treats: 3')).toBeInTheDocument();
    });

    it('does not render when chef feat is absent', () => {
      const stats = { ...basePlayerStats };
      setStore('chefBolsteringTreats', 5);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.queryByText(/Bolstering Treats/)).not.toBeInTheDocument();
    });
  });

  describe('replenishing meal — detection and rendering', () => {
    it('renders Replenishing Meals input when matching passive exists and runtime value > 0', () => {
      const stats = {
        ...basePlayerStats,
        automation: {
          ...basePlayerStats.automation,
          passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }],
        },
      };
      setStore('replenishingMeals', 2);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.getByText('Replenishing Meals: 7')).toBeInTheDocument();
    });

    it('renders when runtime value > 0 regardless of matching passive', () => {
      const stats = {
        ...basePlayerStats,
        automation: {
          ...basePlayerStats.automation,
          passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Other Passive' }],
        },
      };
      setStore('replenishingMeals', 2);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.getByText('Replenishing Meals: 1')).toBeInTheDocument();
    });

    it('does not render when runtime value is 0 even with matching passive', () => {
      const stats = {
        ...basePlayerStats,
        automation: {
          ...basePlayerStats.automation,
          passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }],
        },
      };
      setStore('replenishingMeals', 0);
      const { container } = render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(container.querySelector('div')).toBeNull();
    });
  });

  describe('bolstering treat — standalone resource', () => {
    it('renders when bolsteringTreat > 0 with no features', () => {
      setStore('bolsteringTreat', 1);
      render(<CharFeatFeatures {...defaultProps} />);
      expect(screen.getByText('Bolstering Treat: 1')).toBeInTheDocument();
    });
  });

  describe('multiple features combined', () => {
    it('renders all resource inputs when multiple features are active', () => {
      const stats = {
        ...basePlayerStats,
        feats: ['Lucky'],
        automation: {
          ...basePlayerStats.automation,
          specialActions: [
            { type: 'brew_poison', name: 'Brew Poison' },
            { type: 'temp_hp_buff', name: 'Bolstering Treats' },
          ],
          passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }],
        },
      };
      setStore('luckyPoints', 2);
      setStore('poisonDoses', 1);
      setStore('poisonedWeaponsActive', false);
      setStore('chefBolsteringTreats', 3);
      setStore('replenishingMeals', 2);
      render(<CharFeatFeatures playerStats={stats} campaignName="test-campaign" />);
      expect(screen.getByText('Luck Points: 3')).toBeInTheDocument();
      expect(screen.getByText('Poison Doses: 3')).toBeInTheDocument();
      expect(screen.getByText('Bolstering Treats: 3')).toBeInTheDocument();
      expect(screen.getByText('Replenishing Meals: 7')).toBeInTheDocument();
    });
  });
});
