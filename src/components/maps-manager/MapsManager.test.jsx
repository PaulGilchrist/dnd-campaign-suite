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
  default: () => null,
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

describe('MapsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mapsService.loadMaps.mockResolvedValue({ maps: [] });
  });

  describe('Header & Back Button', () => {
    it('renders header with "Maps" title', () => {
      render(<MapsManager {...defaultProps} />);
      expect(screen.getByRole('heading', { name: 'Maps' })).toBeInTheDocument();
    });

    it('renders back button', () => {
      render(<MapsManager {...defaultProps} />);
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    it('calls onBack when back button is clicked', () => {
      render(<MapsManager {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Create Map Input', () => {
    it('renders create map input', () => {
      render(<MapsManager {...defaultProps} />);
      expect(screen.getByPlaceholderText('New map name...')).toBeInTheDocument();
    });

    it('renders Create Map button', () => {
      render(<MapsManager {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Create Map' })).toBeInTheDocument();
    });

    it('Create Map button is disabled when input is empty', () => {
      render(<MapsManager {...defaultProps} />);
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      expect(createButton).toBeDisabled();
    });

    it('Create Map button is enabled when input has text', () => {
      render(<MapsManager {...defaultProps} />);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'My Map' } });
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      expect(createButton).toBeEnabled();
    });
  });

  describe('Map Type Selector', () => {
    it('renders indoor and outdoor radio options', () => {
      render(<MapsManager {...defaultProps} />);
      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBeGreaterThan(1);
      expect(radios[0].value).toBe('indoor');
      expect(radios[1].value).toBe('outdoor');
    });

    it('defaults to indoor type selected', () => {
      render(<MapsManager {...defaultProps} />);
      const indoorRadio = screen.getByRole('radio', { name: /indoor/i });
      expect(indoorRadio).toBeChecked();
    });

    it('switches to outdoor type when outdoor is clicked', () => {
      render(<MapsManager {...defaultProps} />);
      const outdoorRadio = screen.getByRole('radio', { name: /outdoor/i });
      fireEvent.click(outdoorRadio);
      expect(outdoorRadio).toBeChecked();
      const indoorRadio = screen.getByRole('radio', { name: /indoor/i });
      expect(indoorRadio).not.toBeChecked();
    });
  });

  describe('Loading & Empty States', () => {
    it('shows loading state initially', () => {
      render(<MapsManager {...defaultProps} />);
      expect(screen.getByText('Loading maps...')).toBeInTheDocument();
    });

    it('shows empty state when no maps', async () => {
      render(<MapsManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('No maps yet. Create one to get started.')).toBeInTheDocument();
      });
    });

    it('hides loading state after maps are loaded', async () => {
      render(<MapsManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.queryByText('Loading maps...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Create Map Flow', () => {
    it('creates a map when name is typed and Create Map is clicked', async () => {
      render(<MapsManager {...defaultProps} />);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'Dungeon Level 1' } });
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mapsService.createMap).toHaveBeenCalledWith(
          'test-campaign',
          'Dungeon Level 1',
          { type: 'indoor' }
        );
      });
    });

    it('clears the create input after successful map creation', async () => {
      render(<MapsManager {...defaultProps} />);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'New Map' } });
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('creates an outdoor map when outdoor type is selected', async () => {
      render(<MapsManager {...defaultProps} />);
      const outdoorRadio = screen.getByRole('radio', { name: /outdoor/i });
      fireEvent.click(outdoorRadio);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'Forest Map' } });
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mapsService.createMap).toHaveBeenCalledWith(
          'test-campaign',
          'Forest Map',
          { type: 'outdoor' }
        );
      });
    });

    it('triggers create when Enter key is pressed in create input', async () => {
      render(<MapsManager {...defaultProps} />);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'My Map' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mapsService.createMap).toHaveBeenCalledWith(
          'test-campaign',
          'My Map',
          { type: 'indoor' }
        );
      });
    });

    it('shows error when map name is empty on create', async () => {
      render(<MapsManager {...defaultProps} />);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: '   ' } });
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      expect(createButton).toBeDisabled();
    });
  });

  describe('Maps List Rendering', () => {
    it('renders maps list when maps are provided', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
          { fileName: 'map2.json', name: 'Forest', type: 'outdoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
        expect(screen.getByText('Forest')).toBeInTheDocument();
      });
    });

    it('renders map item with type badge', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Indoor')).toBeInTheDocument();
      });
    });

    it('renders outdoor type badge for outdoor maps', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Forest', type: 'outdoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Outdoor')).toBeInTheDocument();
      });
    });

    it('renders active badge for the active map', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('does not show activate button for the active map', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
    });

    it('renders multiple maps in the list', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
          { fileName: 'map2.json', name: 'Forest', type: 'outdoor', isActive: false },
          { fileName: 'map3.json', name: 'Cave', type: 'indoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
        expect(screen.getByText('Forest')).toBeInTheDocument();
        expect(screen.getByText('Cave')).toBeInTheDocument();
      });
    });

    it('renders map without type badge when type is not set', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Generic Map', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Generic Map')).toBeInTheDocument();
      });

      const mapItem = screen.getByText('Generic Map').closest('.maps-manager-item');
      expect(mapItem?.querySelector('.map-type-badge')).toBeNull();
    });
  });

  describe('Open Button', () => {
    it('calls onOpenMap when Open button is clicked', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      expect(defaultProps.onOpenMap).toHaveBeenCalledWith('map1.json');
    });
  });

  describe('Activate Button', () => {
    it('calls activateMap when Activate button is clicked', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map2.json', name: 'Forest', type: 'outdoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Forest')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

      await waitFor(() => {
        expect(mapsService.activateMap).toHaveBeenCalledWith('test-campaign', 'map2.json');
      });
    });
  });

  describe('Rename Flow', () => {
    it('shows rename input when Rename button is clicked', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      const renameInput = screen.getByDisplayValue('Dungeon Level 1');
      expect(renameInput).toBeInTheDocument();
    });

    it('renames a map when new name is typed and Enter is pressed', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      const renameInput = screen.getByDisplayValue('Dungeon Level 1');
      fireEvent.change(renameInput, { target: { value: 'Renamed Map' } });
      fireEvent.keyDown(renameInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mapsService.renameMap).toHaveBeenCalledWith(
          'test-campaign',
          'map1.json',
          'Renamed Map'
        );
      });
    });

    it('saves rename on blur', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      const renameInput = screen.getByDisplayValue('Dungeon Level 1');
      fireEvent.change(renameInput, { target: { value: 'Renamed Map' } });
      fireEvent.blur(renameInput);

      await waitFor(() => {
        expect(mapsService.renameMap).toHaveBeenCalledWith(
          'test-campaign',
          'map1.json',
          'Renamed Map'
        );
      });
    });

    it('cancels rename when Escape is pressed', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      const renameInput = screen.getByDisplayValue('Dungeon Level 1');
      fireEvent.keyDown(renameInput, { key: 'Escape' });

      expect(screen.queryByDisplayValue('Dungeon Level 1')).not.toBeInTheDocument();
      expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
    });

    it('cancels rename when same name is entered', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      const renameInput = screen.getByDisplayValue('Dungeon Level 1');
      fireEvent.keyDown(renameInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mapsService.renameMap).not.toHaveBeenCalled();
      });
    });

    it('cancels rename when empty name is entered', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

      const renameInput = screen.getByDisplayValue('Dungeon Level 1');
      fireEvent.change(renameInput, { target: { value: '' } });
      fireEvent.keyDown(renameInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mapsService.renameMap).not.toHaveBeenCalled();
      });
    });

    it('shows error when renaming to a duplicate name', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
          { fileName: 'map2.json', name: 'forest', type: 'outdoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const renameButtons = screen.getAllByRole('button', { name: 'Rename' });
      fireEvent.click(renameButtons[0]);

      const renameInput = screen.getByDisplayValue('Dungeon Level 1');
      fireEvent.change(renameInput, { target: { value: 'Forest' } });
      fireEvent.keyDown(renameInput, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('A map with that name already exists')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Flow', () => {
    it('shows delete confirmation modal when Delete button is clicked', async () => {
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

      expect(screen.getByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();
      expect(screen.getByText(/permanently delete/)).toBeInTheDocument();
    });

    it('calls deleteMap when delete is confirmed', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));

      await waitFor(() => {
        expect(mapsService.deleteMap).toHaveBeenCalledWith('test-campaign', 'map1.json');
      });
    });

    it('closes delete modal when Cancel is clicked', async () => {
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
      expect(screen.getByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'Delete Map' })).not.toBeInTheDocument();
    });

    it('closes delete modal when overlay is clicked', async () => {
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
      expect(screen.getByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();

      const overlay = document.querySelector('.maps-manager-modal-overlay');
      fireEvent.click(overlay);

      expect(screen.queryByRole('heading', { name: 'Delete Map' })).not.toBeInTheDocument();
    });
  });

  describe('Edit Description Flow', () => {
    it('opens edit description modal when edit description button is clicked', async () => {
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
        expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
      });
    });

    it('loads map data when opening edit description', async () => {
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
        expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'map1.json');
      });
    });

    it('calls updateMapDescription when Save is clicked in edit modal', async () => {
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
        expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mapsService.updateMapDescription).toHaveBeenCalledWith(
          'test-campaign',
          'map1.json',
          'A dark dungeon.'
        );
      });
    });

    it('closes edit description modal when Cancel is clicked', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.loadMapData.mockResolvedValue({ description: '' });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const editDescButton = screen.getByTitle('Edit description');
      fireEvent.click(editDescButton);

      await waitFor(() => {
        expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText(/Edit Description/)).not.toBeInTheDocument();
    });

    it('closes edit description modal when overlay is clicked', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.loadMapData.mockResolvedValue({ description: '' });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const editDescButton = screen.getByTitle('Edit description');
      fireEvent.click(editDescButton);

      await waitFor(() => {
        expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
      });

      const overlay = document.querySelector('.maps-manager-modal-overlay');
      fireEvent.click(overlay);

      expect(screen.queryByText(/Edit Description/)).not.toBeInTheDocument();
    });

    it('closes edit description modal when X button is clicked', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Dungeon Level 1', type: 'indoor', isActive: true },
        ],
      });
      mapsService.loadMapData.mockResolvedValue({ description: '' });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
      });

      const editDescButton = screen.getByTitle('Edit description');
      fireEvent.click(editDescButton);

      await waitFor(() => {
        expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(screen.queryByText(/Edit Description/)).not.toBeInTheDocument();
    });
  });

  describe('Generate Buttons', () => {
    it('shows Generate Dungeon button for indoor type', () => {
      render(<MapsManager {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Generate Dungeon/i })).toBeInTheDocument();
    });

    it('shows Generate Terrain button for outdoor type', () => {
      render(<MapsManager {...defaultProps} />);
      const outdoorRadio = screen.getByRole('radio', { name: /outdoor/i });
      fireEvent.click(outdoorRadio);
      expect(screen.getByRole('button', { name: /Generate Terrain/i })).toBeInTheDocument();
    });

    it('does not show Generate Dungeon button for outdoor type', () => {
      render(<MapsManager {...defaultProps} />);
      const outdoorRadio = screen.getByRole('radio', { name: /outdoor/i });
      fireEvent.click(outdoorRadio);
      expect(screen.queryByRole('button', { name: /Generate Dungeon/i })).not.toBeInTheDocument();
    });

    it('does not show Generate Terrain button for indoor type', () => {
      render(<MapsManager {...defaultProps} />);
      expect(screen.queryByRole('button', { name: /Generate Terrain/i })).not.toBeInTheDocument();
    });

    it('opens GenerateDungeonModal when Generate Dungeon is clicked', async () => {
      render(<MapsManager {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate Dungeon/i }));
      await waitFor(() => {
        expect(screen.getByTestId('generate-dungeon-modal')).toBeInTheDocument();
      });
    });

    it('opens GenerateTerrainModal when Generate Terrain is clicked', async () => {
      render(<MapsManager {...defaultProps} />);
      const outdoorRadio = screen.getByRole('radio', { name: /outdoor/i });
      fireEvent.click(outdoorRadio);
      fireEvent.click(screen.getByRole('button', { name: /Generate Terrain/i }));
      await waitFor(() => {
        expect(screen.getByTestId('generate-terrain-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Error Display', () => {
    it('displays error when map creation fails', async () => {
      mapsService.createMap.mockRejectedValue(new Error('Server error'));

      render(<MapsManager {...defaultProps} />);
      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'Bad Map' } });
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    it('displays error when loading maps fails', async () => {
      mapsService.loadMaps.mockRejectedValue(new Error('Failed to load'));

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
      });
    });

    it('shows error for duplicate map names', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Existing Map', type: 'indoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Existing Map')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('New map name...');
      fireEvent.change(input, { target: { value: 'Existing Map' } });
      const createButton = screen.getByRole('button', { name: 'Create Map' });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('A map with that name already exists')).toBeInTheDocument();
      });
    });
  });

  describe('Map Item Action Buttons', () => {
    it('renders all action buttons for a non-active map', async () => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Forest', type: 'outdoor', isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Forest')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
      expect(screen.getByTitle('Edit description')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });
});
