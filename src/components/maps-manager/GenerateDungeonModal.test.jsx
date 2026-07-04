// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GenerateDungeonModal from './GenerateDungeonModal';
import * as mapsService from '../../services/maps/mapsService.js';

vi.mock('../../services/maps/dungeonGenerator.js', () => ({
  generateDungeon: vi.fn(() => ({
    name: 'Test Dungeon',
    gridSize: 30,
    walls: [],
    placedItems: [],
    players: [],
    zoom: 1,
    panX: 0,
    panY: 0,
  })),
  generateAdjacentDungeon: vi.fn(() => ({
    name: 'Test Dungeon',
    gridSize: 30,
    walls: [],
    placedItems: [],
    players: [],
    zoom: 1,
    panX: 0,
    panY: 0,
  })),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  createMap: vi.fn().mockResolvedValue({}),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  initialMapName: '',
  onClose: vi.fn(),
  onMapCreated: vi.fn(),
};

describe('GenerateDungeonModal', () => {
  describe('initial render', () => {
    it('renders modal title and form elements', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText('Generate Dungeon Map')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Goblin Hideout')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Random if empty')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
      expect(screen.getByText('BSP Dungeon')).toBeInTheDocument();
      expect(screen.getByText('Room Adjacent')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
    });

    it('is disabled when map name is empty', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    });

    it('populates map name input with initial value', () => {
      render(<GenerateDungeonModal {...defaultProps} initialMapName="Pre-filled Name" />);
      expect(screen.getByDisplayValue('Pre-filled Name')).toBeInTheDocument();
    });
  });

  describe('mode switching', () => {
    it('shows adjacent mode controls when Room Adjacent is selected', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      expect(screen.getByText(/Room Count:/)).toBeInTheDocument();
      expect(screen.getByText('Cramped')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
      expect(screen.getByText('Spacious')).toBeInTheDocument();
      expect(screen.getByText('Compact (rooms adjacent)')).toBeInTheDocument();
      expect(screen.getByText('Balanced')).toBeInTheDocument();
      expect(screen.getByText('Linear')).toBeInTheDocument();
    });
  });

  describe('input updates', () => {
    it('updates map name, seed, grid size, and density state', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'New Name' } });
      expect(screen.getByDisplayValue('New Name')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('Random if empty'), { target: { value: '42' } });
      expect(screen.getByDisplayValue('42')).toBeInTheDocument();
      const gridInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(gridInputs[0], { target: { value: '40' } });
      expect(gridInputs[0]).toHaveValue(40);
      expect(screen.getByRole('slider')).toHaveValue('50');
    });

    it('enables generate button when map name is provided', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'My Dungeon' } });
      expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
    });
  });

  describe('overlay interaction', () => {
    it('calls onClose when overlay is clicked', () => {
      const { container } = render(<GenerateDungeonModal {...defaultProps} />);
      const overlay = container.querySelector('.maps-manager-modal-overlay');
      fireEvent.click(overlay);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('cancel button', () => {
    it('calls onClose when clicked', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('generation flow', () => {
    it('calls callbacks on successful generation', async () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'My Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(defaultProps.onMapCreated).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('disables buttons during generation', async () => {
      let resolve;
      mapsService.createMap.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      expect(screen.getByText('Generating...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      resolve();
    });

    it('shows error when generation fails', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockImplementationOnce(() => { throw new Error('Generation failed'); });
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(screen.getByText('Generation failed')).toBeInTheDocument();
      });
    });
  });

  describe('grid size clamping', () => {
    it('clamps grid size to min 7 and max 100 when generating', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'BSP Dungeon' } });
      const gridInputs = screen.getAllByRole('spinbutton');

      fireEvent.change(gridInputs[0], { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 7 })
        );
      });
      generateDungeon.mockClear();

      fireEvent.change(gridInputs[0], { target: { value: '200' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 100 })
        );
      });
    });

    it('shows clamping error when grid size is out of range', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'BSP Dungeon' } });
      const gridInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(gridInputs[0], { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      expect(screen.getByText(/Grid size must be between/)).toBeInTheDocument();
    });
  });

  describe('generate with BSP mode', () => {
    it('calls generateDungeon with correct params', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'BSP Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalled();
      });
      const callArgs = generateDungeon.mock.calls[0][0];
      expect(callArgs.gridSize).toBe(30);
      expect(callArgs.density).toBe(0.5);
    });

    it('clamps grid size to min 7 and max 100', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'BSP Dungeon' } });
      const gridInputs = screen.getAllByRole('spinbutton');

      fireEvent.change(gridInputs[0], { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 7 })
        );
      });
      generateDungeon.mockClear();

      fireEvent.change(gridInputs[0], { target: { value: '200' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 100 })
        );
      });
    });
  });

  describe('generate with adjacent mode', () => {
    it('calls generateAdjacentDungeon with default params', async () => {
      const { generateAdjacentDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateAdjacentDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Adjacent Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateAdjacentDungeon).toHaveBeenCalled();
      });
      const callArgs = generateAdjacentDungeon.mock.calls[0][0];
      expect(callArgs.roomCount).toBe(8);
      expect(callArgs.corridorLength).toBe('compact');
      expect(callArgs.layoutStyle).toBe('balanced');
    });
  });

  describe('seed handling', () => {
    it('uses provided seed as integer when specified', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Seeded Dungeon' } });
      fireEvent.change(screen.getByPlaceholderText('Random if empty'), { target: { value: '12345' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalled();
      });
      const callArgs = generateDungeon.mock.calls[0][0];
      expect(callArgs.seed).toBe(12345);
    });

    it('uses random seed when seed input is empty', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Random Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalled();
      });
      const callArgs = generateDungeon.mock.calls[0][0];
      expect(typeof callArgs.seed).toBe('number');
      expect(callArgs.seed).toBeGreaterThan(0);
      expect(callArgs.seed).toBeLessThan(2147483647);
    });
  });

  describe('mapsService.createMap', () => {
    it('calls createMap with campaign name and map data on success', async () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'My Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(mapsService.createMap).toHaveBeenCalled();
      });
      const callArgs = mapsService.createMap.mock.calls[0];
      expect(callArgs[0]).toBe('test-campaign');
      expect(callArgs[1]).toBe('My Dungeon');
    });
  });
});
