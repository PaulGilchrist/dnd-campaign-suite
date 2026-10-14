import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharFeats from './CharFeats.jsx';

// Mock the dataLoader module
vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(),
}));

// Mock the usePopup hook
vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({
    showPopup: vi.fn(),
    popupHtml: null,
    setPopupHtml: vi.fn(),
  })),
}));

// Mock the Popup component
vi.mock('../../common/popup.jsx', () => ({
  default: ({ html, onClickOrKeyDown }) => (
    <div data-testid="popup-overlay" onClick={onClickOrKeyDown} dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));

import usePopup from '../../../hooks/combat/usePopup.js';
import { loadFeatData } from '../../../services/ui/dataLoader.js';

const mockSetPopupHtml = vi.fn();
const mockShowPopup = vi.fn();

const mockPlayerStats = {
  feats: ['Actor', 'Athlete'],
  rules: '5e',
};

const mockFeatsData = [
  {
    name: 'Actor',
    index: 'actor',
    desc: ['You look, sound, and act like a different person.'],
  },
  {
    name: 'Athlete',
    index: 'athlete',
    desc: ['You excel at athletic feats.'],
  },
];

const defaultProps = {
  playerStats: mockPlayerStats,
  showPopup: mockShowPopup,
};

describe('CharFeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePopup.mockReturnValue({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    });
    loadFeatData.mockResolvedValue(mockFeatsData);
  });

  describe('null/empty states', () => {
    it('returns null when feats is missing or empty', () => {
      const { container: c1 } = render(<CharFeats playerStats={{}} showPopup={mockShowPopup} />);
      expect(c1.innerHTML).toBe('');

      const { container: c2 } = render(<CharFeats playerStats={{ feats: [] }} showPopup={mockShowPopup} />);
      expect(c2.innerHTML).toBe('');
    });
  });

  describe('feat display', () => {
    it('renders the section header and all feat names as clickable elements', () => {
      render(<CharFeats {...defaultProps} />);
      expect(screen.getByText('Feats:')).toBeInTheDocument();
      expect(screen.getByText('Actor')).toHaveClass('feat-name', 'clickable');
      expect(screen.getByText('Athlete')).toHaveClass('feat-name', 'clickable');
    });

    it('shows count badges for duplicate feats including multiple duplicate sets', () => {
      render(<CharFeats {...defaultProps} playerStats={{ feats: ['Actor', 'Actor', 'Athlete', 'Athlete', 'Athlete'] }} />);
      expect(screen.getByText(/Actor \* 2/)).toBeInTheDocument();
      expect(screen.getByText(/Athlete \* 3/)).toBeInTheDocument();
    });

    it('renders feats with comma separators between them (no separator for single feat)', () => {
      render(<CharFeats {...defaultProps} playerStats={{ feats: ['Actor'] }} />);
      expect(screen.getByText('Actor')).toBeInTheDocument();
      expect(screen.queryByText(', ')).not.toBeInTheDocument();

      render(<CharFeats {...defaultProps} />);
      const texts = screen.getAllByText('Feats:');
      const text = texts[texts.length - 1]?.parentElement?.textContent || '';
      expect(text).toContain(',');
    });

    it('preserves the original feat order', () => {
      const { container } = render(<CharFeats {...defaultProps} playerStats={{ feats: ['Zombie Feat', 'Alpha Feat', 'Beta Feat'] }} />);
      const text = container.textContent;
      const zombieIndex = text.indexOf('Zombie Feat');
      const alphaIndex = text.indexOf('Alpha Feat');
      const betaIndex = text.indexOf('Beta Feat');
      expect(zombieIndex).toBeLessThan(alphaIndex);
      expect(alphaIndex).toBeLessThan(betaIndex);
    });
  });

  describe('feat click behavior', () => {
    it('calls showPopup with the matching feat data when clicked', async () => {
      render(<CharFeats {...defaultProps} />);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(mockShowPopup).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Actor', index: 'actor' })
        );
      });
    });

    it('passes the rules version to loadFeatData (defaults to 5e when missing)', async () => {
      render(<CharFeats {...defaultProps} playerStats={{ feats: ['Actor'] }} />);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(loadFeatData).toHaveBeenCalledWith('5e');
      });
    });

    it('uses 2024 rules version when specified', async () => {
      render(<CharFeats {...defaultProps} playerStats={{ feats: ['Actor'], rules: '2024' }} />);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(loadFeatData).toHaveBeenCalledWith('2024');
      });
    });

    it('finds a feat by index when the name does not match', async () => {
      loadFeatData.mockResolvedValue([
        { name: 'Some Other Feat', index: 'actor', desc: ['Not the actor feat'] },
      ]);
      render(<CharFeats {...defaultProps} />);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(mockShowPopup).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Some Other Feat', index: 'actor' })
        );
      });
    });

    it('handles feat name normalization and uppercase index matching', async () => {
      loadFeatData.mockResolvedValue([
        { name: 'ACTOR', index: 'ACTOR', desc: ['2024 version of Actor feat'] },
      ]);
      render(<CharFeats {...defaultProps} playerStats={{ feats: ['Actor'], rules: '2024' }} />);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(mockShowPopup).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'ACTOR' })
        );
      });
    });
  });

  describe('feat not found handling', () => {
    it('shows a not found message when the feat is absent from the database', async () => {
      loadFeatData.mockResolvedValue([]);
      render(<CharFeats {...defaultProps} />);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Actor')
        );
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('not found in database')
        );
      });
    });
  });

  describe('error handling', () => {
    it('shows error popup, logs error, and includes details when loadFeatData rejects', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      loadFeatData.mockRejectedValue(new Error('Network error'));
      render(<CharFeats {...defaultProps} />);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Actor')
        );
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Error loading feat details')
        );
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Network error')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[CharFeats] Error loading feats'),
          expect.any(Error)
        );
      });
      consoleSpy.mockRestore();
    });
  });
});
