// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const mockShowPopup = vi.fn();
const mockSetPopupHtml = vi.fn();

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
      <div data-testid="popup-overlay" onClick={onClickOrKeyDown}>
        <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
          <span className="dice-roll-hint">click to dismiss</span>
        </div>
      </div>
    );
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((feature) => !!(feature?.automation)),
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
      expect(mockShowPopup).not.toHaveBeenCalled();
      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });
  });
});
