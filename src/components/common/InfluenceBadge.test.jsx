// @maintained-by-ai 2026-11-26
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import InfluenceBadge from './InfluenceBadge.jsx';
import {
  getInfluenceTier,
  influenceTierClass,
} from '../../services/campaign/influenceTierDisplay.js';

describe('influence tier canon', () => {
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
  ])('maps influence %i to the %s tier and its color-token class', (influence, tier) => {
    expect(getInfluenceTier(influence)).toBe(tier);
    expect(influenceTierClass(influence)).toBe(`influence-tier--${tier}`);
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
