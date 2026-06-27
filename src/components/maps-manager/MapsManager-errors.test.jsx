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

describe('MapsManager - Error Paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mapsService.loadMaps.mockResolvedValue({ maps: [] });
  });

  describe('Save Description Error Path', () => {
    it('displays error when saving map description fails', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.loadMapData.mockResolvedValue({ description: 'A dark dungeon.' });
      mapsService.updateMapDescription.mockRejectedValue(new Error('Save failed'));

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const editDescButton = screen.getByTitle('Edit description');
      fireEvent.click(editDescButton);

      await waitFor(() => {
        expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Error Path', () => {
    it('displays error when deleting map fails', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.deleteMap.mockRejectedValue(new Error('Delete failed'));

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));

      await waitFor(() => {
        expect(screen.getByText('Delete failed')).toBeInTheDocument();
      });
    });
  });

  describe('Rename Error Path', () => {
    it('displays error when renaming map fails', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.renameMap.mockRejectedValue(new Error('Rename failed'));

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      const renameInput = screen.getByDisplayValue('Dungeon Level 1');
      fireEvent.change(renameInput, { target: { value: 'Completely New Name' } });
      fireEvent.keyDown(renameInput, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Rename failed')).toBeInTheDocument();
      });
    });
  });

  describe('Load Map Data Error Path', () => {
    it('displays error when loading map data for description edit fails', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.loadMapData.mockRejectedValue(new Error('Load failed'));

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const editDescButton = screen.getByTitle('Edit description');
      fireEvent.click(editDescButton);

      await waitFor(() => {
        expect(screen.getByText('Load failed')).toBeInTheDocument();
      });
    });
  });

  describe('Activate Error Path', () => {
    it('displays error when activating map fails', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map2.json', name: 'Forest', type: 'outdoor', isActive: false },
        ],
      });
      mapsService.activateMap.mockRejectedValue(new Error('Activate failed'));

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Forest')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

      await waitFor(() => {
        expect(screen.getByText('Activate failed')).toBeInTheDocument();
      });
    });
  });
});
