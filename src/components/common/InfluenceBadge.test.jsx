import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import InfluenceBadge from './InfluenceBadge.jsx';
import {
  INFLUENCE_TIERS,
  getInfluenceTier,
  influenceTierClass,
} from '../../services/campaign/influenceTierDisplay.js';

describe('influence tier canon', () => {
  it('publishes the four tiers in ladder order', () => {
    expect(INFLUENCE_TIERS).toEqual(['low', 'medium', 'high', 'extreme']);
  });

  // Thresholds pinned verbatim from the planner's pre-extraction logic:
  // <=3 low, <=6 medium, <=8 high, else extreme (authored range 1–10).
  it.each([
    [1, 'low'],
    [3, 'low'],
    [4, 'medium'],
    [6, 'medium'],
    [7, 'high'],
    [8, 'high'],
    [9, 'extreme'],
    [10, 'extreme'],
  ])('maps influence %i to the %s tier', (influence, tier) => {
    expect(getInfluenceTier(influence)).toBe(tier);
  });

  it('tiers via a class carrying the shared color tokens', () => {
    expect(influenceTierClass(2)).toBe('influence-tier--low');
    expect(influenceTierClass(10)).toBe('influence-tier--extreme');
  });
});

describe('InfluenceBadge', () => {
  it('renders the numeric chip with its tier class and value title', () => {
    render(<InfluenceBadge influence={7} />);
    const badge = screen.getByTitle('Influence: 7');
    expect(badge).toHaveClass('influence-badge', 'influence-tier--high');
    expect(badge).toHaveTextContent('7');
  });
});
