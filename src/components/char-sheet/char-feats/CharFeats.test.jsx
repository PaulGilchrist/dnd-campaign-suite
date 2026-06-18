// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
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
vi.mock('../../common/Popup.jsx', () => ({
  default: vi.fn(({ html }) => (
    <div data-testid="popup-overlay" dangerouslySetInnerHTML={{ __html: html }} />
  )),
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

  describe('rendering', () => {
    it('should return null when feats array is empty', () => {
      const { container } = render(
        <CharFeats playerStats={{ feats: [] }} showPopup={mockShowPopup} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should return null when feats is undefined', () => {
      const { container } = render(
        <CharFeats playerStats={{}} showPopup={mockShowPopup} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should return null when feats is null', () => {
      const { container } = render(
        <CharFeats playerStats={{ feats: null }} showPopup={mockShowPopup} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should display the Feats label', () => {
      render(<CharFeats {...defaultProps} />);
      expect(screen.getByText(/Feats:/)).toBeInTheDocument();
    });

    it('should display all feat names', () => {
      render(<CharFeats {...defaultProps} />);
      expect(screen.getByText(/Actor/)).toBeInTheDocument();
      expect(screen.getByText(/Athlete/)).toBeInTheDocument();
    });

    it('should separate multiple feats with commas', () => {
      render(<CharFeats {...defaultProps} />);
      const featsContainer = screen.getByText(/Feats:/).parentElement;
      expect(featsContainer.textContent).toContain(',');
    });

    it('should not include trailing comma after the last feat', () => {
      render(<CharFeats {...defaultProps} />);
      const featsContainer = screen.getByText(/Feats:/).parentElement;
      const text = featsContainer.textContent;
      expect(text).not.toMatch(/,\s*$/);
    });

    it('should render a single feat without a trailing comma', () => {
      render(<CharFeats playerStats={{ feats: ['Actor'], rules: '5e' }} showPopup={mockShowPopup} />);
      expect(screen.getByText(/Actor/)).toBeInTheDocument();
      const featsContainer = screen.getByText(/Feats:/).parentElement;
      expect(featsContainer.textContent).toBe('Feats: Actor');
    });

    it('should render feat names as clickable elements', () => {
      render(<CharFeats {...defaultProps} />);
      const actorLink = screen.getByText(/Actor/);
      expect(actorLink).toHaveClass('clickable');
      expect(actorLink).toHaveClass('feat-name');
    });

    it('should render all feat names even when some are not found in database', () => {
      render(
        <CharFeats
          playerStats={{ feats: ['Unknown Feat', 'Actor'], rules: '5e' }}
          showPopup={mockShowPopup}
        />
      );
      expect(screen.getByText(/Unknown Feat/)).toBeInTheDocument();
      expect(screen.getByText(/Actor/)).toBeInTheDocument();
    });
  });

  describe('feat click behavior', () => {
    it('should call loadFeatData with "5e" when a feat is clicked', async () => {
      render(<CharFeats {...defaultProps} />);
      const actorElements = screen.getAllByText(/Actor/);
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(loadFeatData).toHaveBeenCalledWith('5e');
      });
    });

    it('should call loadFeatData with "2024" when rules is 2024', async () => {
      render(
        <CharFeats
          playerStats={{ feats: ['Actor'], rules: '2024' }}
          showPopup={mockShowPopup}
        />
      );
      const actorElements = screen.getAllByText('Actor');
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(loadFeatData).toHaveBeenCalledWith('2024');
      });
    });

    it('should default to "5e" when rules is undefined', async () => {
      render(
        <CharFeats
          playerStats={{ feats: ['Actor'] }}
          showPopup={mockShowPopup}
        />
      );
      const actorElements = screen.getAllByText('Actor');
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(loadFeatData).toHaveBeenCalledWith('5e');
      });
    });

    it('should call showPopup with feat data when found by name', async () => {
      render(<CharFeats {...defaultProps} />);
      const actorElements = screen.getAllByText(/Actor/);
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(mockShowPopup).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Actor', index: 'actor' })
        );
      });
    });

    it('should call showPopup with feat data when found by index', async () => {
      render(<CharFeats {...defaultProps} />);
      const actorElements = screen.getAllByText(/Actor/);
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(mockShowPopup).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Actor', index: 'actor' })
        );
      });
    });

    it('should match feat by normalized index when feat name has spaces', async () => {
      const featsWithSpaces = [
        { name: 'Actor feat', index: 'actor_feat', desc: ['A feat with spaces.'] },
      ];
      loadFeatData.mockResolvedValue(featsWithSpaces);

      render(
        <CharFeats
          playerStats={{ feats: ['Actor Feat'], rules: '5e' }}
          showPopup={mockShowPopup}
        />
      );
      const featElements = screen.getAllByText('Actor Feat');
      fireEvent.click(featElements[0]);
      await vi.waitFor(() => {
        expect(mockShowPopup).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Actor feat' })
        );
      });
    });

    it('should call setPopupHtml when feat is not found in database', async () => {
      loadFeatData.mockResolvedValue([]);
      render(<CharFeats {...defaultProps} />);
      const actorElements = screen.getAllByText(/Actor/);
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Feat details not found in database')
        );
      });
    });

    it('should call setPopupHtml when featsData is null', async () => {
      loadFeatData.mockResolvedValue(null);
      render(<CharFeats {...defaultProps} />);
      const actorElements = screen.getAllByText(/Actor/);
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Feat details not found in database')
        );
      });
    });

    it('should call setPopupHtml with error message when loadFeatData rejects', async () => {
      loadFeatData.mockRejectedValue(new Error('Network error'));
      render(<CharFeats {...defaultProps} />);
      const actorElements = screen.getAllByText(/Actor/);
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Error loading feat details')
        );
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Network error')
        );
      });
    });

    it('should call setPopupHtml when feat is not found even though data loaded', async () => {
      loadFeatData.mockResolvedValue([
        { name: 'Other Feat', index: 'other-feat', desc: ['Some other feat.'] },
      ]);
      render(<CharFeats {...defaultProps} />);
      const actorElements = screen.getAllByText(/Actor/);
      fireEvent.click(actorElements[0]);
      await vi.waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Feat details not found in database')
        );
      });
    });
  });

  describe('popup rendering', () => {
    it('should render the Popup component when popupHtml is set', () => {
      usePopup.mockReturnValue({
        showPopup: vi.fn(),
        popupHtml: '<b>Test</b> popup content',
        setPopupHtml: mockSetPopupHtml,
      });
      render(<CharFeats {...defaultProps} />);
      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });

    it('should not render the Popup component when popupHtml is null', () => {
      usePopup.mockReturnValue({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      });
      render(<CharFeats {...defaultProps} />);
      expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
    });
  });
});
