// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MapsManager from './MapsManager.jsx';

// Mock the mapsService
vi.mock('../../services/maps/mapsService.js', () => ({
  loadMaps: vi.fn().mockResolvedValue({ maps: [] }),
  createMap: vi.fn().mockResolvedValue({}),
  deleteMap: vi.fn().mockResolvedValue({}),
  renameMap: vi.fn().mockResolvedValue({}),
  activateMap: vi.fn().mockResolvedValue({}),
  loadMapData: vi.fn().mockResolvedValue({}),
  updateMapDescription: vi.fn().mockResolvedValue({}),
  formatMapName: (name) => name,
}));

// Mock child components
vi.mock('../common/PreviewToggle.jsx', () => ({
  default: () => <div data-testid="preview-toggle" />,
}));

vi.mock('../common/Subscriber.jsx', () => ({
  default: () => <div data-testid="subscriber" />,
}));

vi.mock('./GenerateDungeonModal.jsx', () => ({
  default: () => <div data-testid="generate-dungeon-modal" />,
}));

vi.mock('./GenerateTerrainModal.jsx', () => ({
  default: () => <div data-testid="generate-terrain-modal" />,
}));

import * as mapsService from '../../services/maps/mapsService.js';

const defaultProps = {
  campaignName: 'test-campaign',
  onOpenMap: vi.fn(),
  onBack: vi.fn(),
};

describe('MapsManager - SSE & Modal Props', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mapsService.loadMaps.mockResolvedValue({ maps: [] });
  });

  describe('SSE Event Handling', () => {
    it('renders Subscriber component for SSE subscription', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      expect(screen.getByTestId('subscriber')).toBeInTheDocument();
    });

    it('Subscriber is passed the handleSSEEvent callback', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const subscriber = screen.getByTestId('subscriber');
      expect(subscriber).toBeInTheDocument();
    });

    it('Subscriber is passed the campaignName prop', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const subscriber = screen.getByTestId('subscriber');
      expect(subscriber).toBeInTheDocument();
    });
  });

  describe('Generate Modal Props', () => {
    it('passes initialMapName to GenerateDungeonModal', async () => {
      render(<MapsManager {...defaultProps} />);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'My Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: /Generate Dungeon/i }));

      await waitFor(() => {
        const modal = screen.getByTestId('generate-dungeon-modal');
        expect(modal).toBeInTheDocument();
      });
    });

    it('passes initialMapName to GenerateTerrainModal', async () => {
      render(<MapsManager {...defaultProps} />);
      const outdoorRadio = screen.getByRole('radio', { name: /outdoor/i });
      fireEvent.click(outdoorRadio);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'My Terrain' } });
      fireEvent.click(screen.getByRole('button', { name: /Generate Terrain/i }));

      await waitFor(() => {
        const modal = screen.getByTestId('generate-terrain-modal');
        expect(modal).toBeInTheDocument();
      });
    });
  });

  describe('Maps Sorting', () => {
    it('renders maps sorted alphabetically by name', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map3.json', name: 'Zoo', type: 'indoor', isActive: false },
          { fileName: 'map1.json', name: 'Alpha Cave', type: 'indoor', isActive: true },
          { fileName: 'map2.json', name: 'Beta Forest', type: 'outdoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Cave')).toBeInTheDocument();
        expect(screen.getByText('Beta Forest')).toBeInTheDocument();
        expect(screen.getByText('Zoo')).toBeInTheDocument();
      });

      const items = document.querySelectorAll('.maps-manager-item');
      expect(items[0].textContent).toContain('Alpha Cave');
      expect(items[1].textContent).toContain('Beta Forest');
      expect(items[2].textContent).toContain('Zoo');
    });
  });

  describe('Active Map Item Class', () => {
    it('applies active class to the active map item', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
          { fileName: 'map2.json', name: 'Forest', type: 'outdoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const activeItem = document.querySelector('.maps-manager-item.active');
      expect(activeItem).toBeInTheDocument();
      expect(activeItem.textContent).toContain('Dungeon Level 1');
    });
  });
});
