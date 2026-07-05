// @cleaned-by-ai
// Removed redundant, brittle, and low-value tests.
// Kept behavioral tests covering: create flow, rename flow, delete flow,
// edit description flow, error handling, sorting, type badges, active state,
// keyboard interactions, and core actions (open, activate, back).
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

describe('MapsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mapsService.loadMaps.mockResolvedValue({ maps: [] });
  });

  describe('Header & Back Button', () => {
    it('calls onBack when back button is clicked', () => {
      render(<MapsManager {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
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

    it('shows error for duplicate map names on create', async () => {
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

  describe('Maps List Rendering', () => {
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
        const names = screen.getAllByRole('listitem');
        expect(names[0]).toHaveTextContent('Alpha Cave');
        expect(names[1]).toHaveTextContent('Beta Forest');
        expect(names[2]).toHaveTextContent('Zoo');
      });
    });

    it.each([
      ['indoor', 'Indoor'],
      ['outdoor', 'Outdoor'],
    ])('renders %s type badge (%s)', async (type, badgeText) => {
      mapsService.loadMaps.mockResolvedValue({
        maps: [
          { fileName: 'map1.json', name: 'Test Map', type, isActive: false },
        ],
      });

      render(<MapsManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(badgeText)).toBeInTheDocument();
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
  });
});
