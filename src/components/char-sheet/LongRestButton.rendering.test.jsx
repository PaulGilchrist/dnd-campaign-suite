import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocks ──

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  applyLongRest: vi.fn(),
}));

// ── Re-import mocks ──

import * as tranceRules from '../../services/rules/effects/tranceRules.js';

// ── Fixtures ──

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 45,
  class: { name: 'Cleric' },
};

const trancePlayerStats = {
  ...basePlayerStats,
  race: { traits: [{ name: 'Trance' }] },
};

const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    playerStats: basePlayerStats,
    campaignName: mockCampaignName,
    onLongRest: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('LongRestButton rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends "(4 hours)" suffix to button text when character has Trance trait', () => {
    tranceRules.hasTranceTrait.mockReturnValue(true);
    render(<LongRestButton {...makeProps({ playerStats: trancePlayerStats })} />);

    expect(screen.getByRole('button')).toHaveTextContent('Long Rest (4 hours)');
  });

  it('sets correct title for characters without Trance', () => {
    tranceRules.hasTranceTrait.mockReturnValue(false);
    render(<LongRestButton {...makeProps()} />);

    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Long Rest: restore all HP, spell slots, hit dice, and class resources',
    );
  });

  it('sets correct title with "(4 hours)" prefix for characters with Trance', () => {
    tranceRules.hasTranceTrait.mockReturnValue(true);
    render(<LongRestButton {...makeProps({ playerStats: trancePlayerStats })} />);

    expect(screen.getByRole('button')).toHaveAttribute(
      'title',
      'Long Rest (4 hours): restore all HP, spell slots, hit dice, and class resources',
    );
  });
});
