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

  describe('section header', () => {
    it('renders the Character Advancement section header', () => {
      renderComponent();
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
    });

    it('renders a half-line separator after the section', () => {
      renderComponent();
      expect(document.querySelector('.half-line')).toBeInTheDocument();
    });
  });

  describe('feature rendering', () => {
    it('renders each feature name followed by a colon', () => {
      renderComponent();
      expect(screen.getByText('Feature 1:')).toBeInTheDocument();
      expect(screen.getByText('Feature 2:')).toBeInTheDocument();
    });

    it('renders each feature description as sanitized HTML', () => {
      renderComponent();
      expect(screen.getByText('A feature description')).toBeInTheDocument();
      expect(screen.getByText('Another feature')).toBeInTheDocument();
    });

    it('renders features with no name using index-based key', () => {
      const stats = createPlayerStats({
        characterAdvancement: [{ description: 'Unnamed feature' }],
      });
      render(<CharCharacterAdvancement playerStats={stats} campaignName="test-campaign" />);
      expect(screen.getByText('Unnamed feature')).toBeInTheDocument();
    });

    it('renders an empty array of features without errors', () => {
      renderComponent({ characterAdvancement: [] });
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    it('handles null characterAdvancement gracefully', () => {
      renderComponent({ characterAdvancement: null });
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();
    });

    it('handles undefined characterAdvancement gracefully', () => {
      const { rerender } = render(
        <CharCharacterAdvancement playerStats={{ name: 'Test Character' }} campaignName="test-campaign" />
      );
      expect(screen.getByText('Character Advancement')).toBeInTheDocument();

      rerender(
        <CharCharacterAdvancement
          playerStats={createPlayerStats({ characterAdvancement: [{ name: 'New Feature', description: 'Desc' }] })}
          campaignName="test-campaign"
        />
      );
      expect(screen.getByText('New Feature:')).toBeInTheDocument();
    });
  });

  describe('clickable feature behavior', () => {
    it('does not apply clickable class to any feature', () => {
      renderComponent();
      expect(screen.getByText('Feature 1:')).not.toHaveClass('clickable');
      expect(screen.getByText('Feature 2:')).not.toHaveClass('clickable');
    });
  });

  describe('feature name key uniqueness', () => {
    it('renders features with unique DOM keys', () => {
      renderComponent();
      const boldElements = document.querySelectorAll('b');
      expect(boldElements.length).toBe(2);
    });
  });
});
