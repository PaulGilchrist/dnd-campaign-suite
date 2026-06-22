// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

describe('CharCharacterAdvancement - Feature display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePlayerStats = {
    name: 'Test Character',
    characterAdvancement: [
      {
        name: 'Auto Feature',
        description: 'Has automation',
        automation: { type: 'test' },
      },
    ],
  };

  const baseProps = {
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
  };

  describe('feature click behavior', () => {
    it('does not render feature as clickable when it has automation', () => {
      render(<CharCharacterAdvancement {...baseProps} />);
      const feature = screen.getByText('Auto Feature:');
      expect(feature).not.toHaveClass('clickable');
    });

    it('does not show a popup when clicking a feature', async () => {
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });
  });
});
