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

describe('MapsManager - CSS Classes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mapsService.loadMaps.mockResolvedValue({ maps: [] });
  });

  describe('Maps List CSS Class', () => {
    it('renders maps list container', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const list = document.querySelector('.maps-manager-list');
      expect(list).toBeInTheDocument();
    });
  });

  describe('Map Type Badge CSS Classes', () => {
    it('applies indoor class to indoor type badge', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Indoor')).toBeInTheDocument();
      });

      const badge = document.querySelector('.map-type-badge.indoor');
      expect(badge).toBeInTheDocument();
    });

    it('applies outdoor class to outdoor type badge', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Forest', type: 'outdoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Outdoor')).toBeInTheDocument();
      });

      const badge = document.querySelector('.map-type-badge.outdoor');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Maps Manager CSS Classes', () => {
    it('renders maps manager wrapper', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const wrapper = document.querySelector('.maps-manager');
      expect(wrapper).toBeInTheDocument();
    });

    it('renders maps manager header wrapper', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const header = document.querySelector('.maps-manager-header');
      expect(header).toBeInTheDocument();
    });

    it('renders maps manager create wrapper', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const createWrapper = document.querySelector('.maps-manager-create');
      expect(createWrapper).toBeInTheDocument();
    });
  });

  describe('Error Display CSS Class', () => {
    it('applies error CSS class to error display', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.createMap.mockRejectedValue(new Error('Create failed'));

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'Bad Map' } });
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      fireEvent.click(createButton);

      await waitFor(() => {
        const errorEl = document.querySelector('.maps-manager-error');
        expect(errorEl).toBeInTheDocument();
        expect(errorEl.textContent).toBe('Create failed');
      });
    });
  });

  describe('Loading State CSS Class', () => {
    it('applies loading CSS class to loading display', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      const loadingEl = document.querySelector('.maps-manager-loading');
      expect(loadingEl).toBeInTheDocument();
    });
  });

  describe('Empty State CSS Class', () => {
    it('applies empty state CSS class', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const emptyEl = document.querySelector('.maps-manager-empty');
      expect(emptyEl).toBeInTheDocument();
    });
  });

  describe('Maps Manager Item CSS Class', () => {
    it('applies item CSS class to each map item', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const item = document.querySelector('.maps-manager-item');
      expect(item).toBeInTheDocument();
    });
  });

  describe('Maps Manager Item Info CSS Class', () => {
    it('applies item-info CSS class', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const info = document.querySelector('.maps-manager-item-info');
      expect(info).toBeInTheDocument();
    });
  });

  describe('Maps Manager Item Actions CSS Class', () => {
    it('applies item-actions CSS class', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const actions = document.querySelector('.maps-manager-item-actions');
      expect(actions).toBeInTheDocument();
    });
  });

  describe('Maps Manager Item Name CSS Class', () => {
    it('applies item-name CSS class to map name', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const nameEl = document.querySelector('.maps-manager-item-name');
      expect(nameEl).toBeInTheDocument();
      expect(nameEl.textContent).toContain('Dungeon Level 1');
    });
  });

  describe('Maps Manager Active Badge CSS Class', () => {
    it('applies active-badge CSS class', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });

      const badge = document.querySelector('.maps-manager-active-badge');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Edit Description Modal CSS Classes', () => {
    it('renders edit description modal overlay', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.loadMapData.mockResolvedValue({ description: 'A dark dungeon.' });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const editDescButton = screen.getByTitle('Edit description');
      fireEvent.click(editDescButton);

      await waitFor(() => {
        const overlay = document.querySelector('.maps-manager-modal-overlay');
        expect(overlay).toBeInTheDocument();
      });
    });

    it('renders edit description modal container', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.loadMapData.mockResolvedValue({ description: 'A dark dungeon.' });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const editDescButton = screen.getByTitle('Edit description');
      fireEvent.click(editDescButton);

      await waitFor(() => {
        const modal = document.querySelector('.maps-manager-modal');
        expect(modal).toBeInTheDocument();
      });
    });
  });

  describe('Delete Modal CSS Classes', () => {
    it('renders delete modal overlay', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      const overlay = document.querySelector('.maps-manager-modal-overlay');
      expect(overlay).toBeInTheDocument();
    });

    it('renders delete modal container', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      const modal = document.querySelector('.maps-manager-modal');
      expect(modal).toBeInTheDocument();
    });
  });

  describe('Map Type Selector CSS Classes', () => {
    it('applies active class to selected map type option', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const activeOption = document.querySelector('.map-type-option.active');
      expect(activeOption).toBeInTheDocument();
      expect(activeOption.textContent).toContain('Indoor');
    });

    it('updates active class when map type changes', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const outdoorRadio = screen.getByRole('radio', { name: /outdoor/i });
      fireEvent.click(outdoorRadio);

      const activeOption = document.querySelector('.map-type-option.active');
      expect(activeOption.textContent).toContain('Outdoor');
    });
  });

  describe('Map Type Selector Wrapper', () => {
    it('renders map type selector wrapper', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const selector = document.querySelector('.map-type-selector');
      expect(selector).toBeInTheDocument();
    });
  });

  describe('Back Button CSS Class', () => {
    it('applies back-button class to back button', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const backBtn = document.querySelector('.back-button');
      expect(backBtn).toBeInTheDocument();
    });
  });

  describe('Generate Dungeon Button CSS Class', () => {
    it('applies generate-dungeon-btn class to generate dungeon button', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });

      const btn = document.querySelector('.generate-dungeon-btn');
      expect(btn).toBeInTheDocument();
    });
  });
});
