// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

const createPlayerStats = (overrides = {}) => ({
  name: 'Test Character',
  characterAdvancement: [
    {
      name: 'Feature 1',
      description: 'A feature description',
      details: 'Feature details',
    },
    {
      name: 'Feature 2',
      description: 'Another feature',
    },
  ],
  ...overrides,
});

const renderComponent = (playerStatsOverrides = {}) => {
  const playerStats = createPlayerStats(playerStatsOverrides);
  return render(<CharCharacterAdvancement playerStats={playerStats} campaignName="test-campaign" />);
};

describe('CharCharacterAdvancement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('feature rendering', () => {
    it('renders feature names and descriptions', () => {
      renderComponent();
      expect(screen.getByText('Feature 1:')).toBeInTheDocument();
      expect(screen.getByText('Feature 2:')).toBeInTheDocument();
      expect(screen.getByText('A feature description')).toBeInTheDocument();
      expect(screen.getByText('Another feature')).toBeInTheDocument();
    });

    it('renders the section header when characterAdvancement is empty or null', () => {
      const { unmount } = renderComponent({ characterAdvancement: [] });
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
      unmount();

      renderComponent({ characterAdvancement: null });
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
    });
  });
});
