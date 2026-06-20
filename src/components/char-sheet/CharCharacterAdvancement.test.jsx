// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const { mockShowPopup, mockSetPopupHtml, mockHasAutomation } = vi.hoisted(() => ({
  mockShowPopup: vi.fn(),
  mockSetPopupHtml: vi.fn(),
  mockHasAutomation: vi.fn(),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({
    showPopup: mockShowPopup,
    popupHtml: null,
    setPopupHtml: mockSetPopupHtml,
  })),
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ html, onClickOrKeyDown }) {
    return (
      <div data-testid="popup" onClick={onClickOrKeyDown}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: mockHasAutomation,
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
    mockHasAutomation.mockReturnValue(false);
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
    it('applies clickable class when feature has details', () => {
      renderComponent();
      expect(screen.getByText('Feature 1:')).toHaveClass('clickable');
    });

    it('does not apply clickable class when feature has no details and no automation', () => {
      renderComponent();
      expect(screen.getByText('Feature 2:')).not.toHaveClass('clickable');
    });

    it('applies clickable class when feature has automation but no details', () => {
      mockHasAutomation.mockReturnValueOnce(true).mockReturnValueOnce(false);
      const stats = createPlayerStats({
        characterAdvancement: [
          { name: 'Auto Feature', description: 'Has automation' },
          { name: 'No Auto', description: 'No automation' },
        ],
      });
      render(<CharCharacterAdvancement playerStats={stats} campaignName="test-campaign" />);
      expect(screen.getByText('Auto Feature:')).toHaveClass('clickable');
      expect(screen.getByText('No Auto:')).not.toHaveClass('clickable');
    });
  });

  describe('feature click behavior', () => {
    it('calls showPopup when clicking a feature with details', () => {
      renderComponent();
      fireEvent.click(screen.getByText('Feature 1:'));
      expect(mockShowPopup).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Feature 1',
          description: 'A feature description',
          details: 'Feature details',
        })
      );
    });

    it('calls showPopup when clicking any feature', () => {
      mockHasAutomation.mockReturnValue(true);
      const stats = createPlayerStats({
        characterAdvancement: [
          { name: 'Auto Feature', description: 'Has automation' },
        ],
      });
      render(<CharCharacterAdvancement playerStats={stats} campaignName="test-campaign" />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      expect(mockShowPopup).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Auto Feature',
          description: 'Has automation',
        })
      );
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
