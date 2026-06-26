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
    it('renders modal title', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText('Generate Dungeon Map')).toBeInTheDocument();
    });

    it('renders map name input', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByPlaceholderText('e.g. Goblin Hideout')).toBeInTheDocument();
    });

    it('renders seed input', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByPlaceholderText('Random if empty')).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders generate button', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    });

    it('renders note text', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText(/starting point/)).toBeInTheDocument();
    });

    it('renders mode selector with BSP option', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText('BSP Dungeon')).toBeInTheDocument();
    });

    it('renders mode selector with Room Adjacent option', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText('Room Adjacent')).toBeInTheDocument();
    });

    it('renders density slider for BSP mode', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('has BSP mode selected by default', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText('BSP Dungeon').closest('button')).toHaveClass('active');
    });

    it('shows density hint text', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText(/Moderate/)).toBeInTheDocument();
    });

    it('has grid size spinbutton', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
    });

    it('is disabled when map name is empty', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    });
  });

  describe('initialMapName prop', () => {
    it('populates map name input with initial value', () => {
      render(<GenerateDungeonModal {...defaultProps} initialMapName="Pre-filled Name" />);
      expect(screen.getByDisplayValue('Pre-filled Name')).toBeInTheDocument();
    });
  });

  describe('mode switching', () => {
    it('switches to adjacent mode', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      expect(screen.getByText('Room Adjacent').closest('button')).toHaveClass('active');
    });

    it('renders room count for adjacent mode', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      expect(screen.getByText(/Room Count:/)).toBeInTheDocument();
    });

    it('renders room size options for adjacent mode', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      expect(screen.getByText('Cramped')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
      expect(screen.getByText('Spacious')).toBeInTheDocument();
    });

    it('renders corridor length options for adjacent mode', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      expect(screen.getByText('Compact (rooms adjacent)')).toBeInTheDocument();
    });

    it('renders layout style options for adjacent mode', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      expect(screen.getByText('Balanced')).toBeInTheDocument();
      expect(screen.getByText('Linear')).toBeInTheDocument();
    });

    it('selects room size option', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.click(screen.getByText('Cramped'));
      expect(screen.getByText('Cramped').closest('button')).toHaveClass('active');
    });

    it('selects corridor length option', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.click(screen.getByText('Compact (rooms adjacent)'));
      expect(screen.getByText('Compact (rooms adjacent)').closest('button')).toHaveClass('active');
    });

    it('selects layout style option', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.click(screen.getByText('Linear'));
      expect(screen.getByText('Linear').closest('button')).toHaveClass('active');
    });
  });

  describe('input updates', () => {
    it('map name input updates state', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'New Name' } });
      expect(screen.getByDisplayValue('New Name')).toBeInTheDocument();
    });

    it('seed input updates state', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('Random if empty'), { target: { value: '42' } });
      expect(screen.getByDisplayValue('42')).toBeInTheDocument();
    });

    it('grid size input updates state', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      const gridInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(gridInputs[0], { target: { value: '40' } });
      expect(gridInputs[0]).toHaveValue(40);
    });

    it('density slider has default value', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByRole('slider')).toHaveValue('50');
    });

    it('generate button is enabled when map name is provided', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'My Dungeon' } });
      expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
    });
  });

  describe('overlay interaction', () => {
    it('overlay click calls onClose', () => {
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
    it('shows generating state on generate click', async () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'My Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(screen.getByText(/Generating/)).toBeInTheDocument();
      });
    });

    it('calls onMapCreated and onClose on successful generation', async () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'My Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(defaultProps.onMapCreated).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('shows error when map name is empty on generate', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      const generateBtn = screen.getByRole('button', { name: 'Generate' });
      fireEvent.click(generateBtn);
      expect(generateBtn).toHaveAttribute('disabled');
    });

    it('shows generating state during generation', async () => {
      let resolve;
      mapsService.createMap.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      expect(screen.getByText('Generating...')).toBeInTheDocument();
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

  describe('BSP density hint changes', () => {
    it('shows sparse hint when density is low', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByRole('slider'), { target: { value: '20' } });
      expect(screen.getByText(/Sparse/)).toBeInTheDocument();
    });

    it('shows dense hint when density is high', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByRole('slider'), { target: { value: '80' } });
      expect(screen.getByText(/Dense/)).toBeInTheDocument();
    });
  });

  describe('grid size hint', () => {
    it('shows grid size hint with default value', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('updates grid size hint when grid size changes', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      const gridInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(gridInputs[0], { target: { value: '40' } });
      expect(screen.getByText(/40 ft/)).toBeInTheDocument();
    });
  });

  describe('room count slider default', () => {
    it('shows room count default of 8 in adjacent mode', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      expect(screen.getByText(/Room Count: 8/)).toBeInTheDocument();
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

    it('calls generateDungeon with density from slider', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'BSP Dungeon' } });
      fireEvent.change(screen.getByRole('slider'), { target: { value: '80' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalled();
      });
      const callArgs = generateDungeon.mock.calls[0][0];
      expect(callArgs.density).toBe(0.8);
    });

    it('clamps grid size to min 7', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'BSP Dungeon' } });
      const gridInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(gridInputs[0], { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalled();
      });
      const callArgs = generateDungeon.mock.calls[0][0];
      expect(callArgs.gridSize).toBe(7);
    });

    it('clamps grid size to max 100', async () => {
      const { generateDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'BSP Dungeon' } });
      const gridInputs = screen.getAllByRole('spinbutton');
      fireEvent.change(gridInputs[0], { target: { value: '200' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateDungeon).toHaveBeenCalled();
      });
      const callArgs = generateDungeon.mock.calls[0][0];
      expect(callArgs.gridSize).toBe(100);
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

  describe('generate with adjacent mode', () => {
    it('calls generateAdjacentDungeon when in adjacent mode', async () => {
      const { generateAdjacentDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateAdjacentDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Adjacent Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateAdjacentDungeon).toHaveBeenCalled();
      });
    });

    it('passes roomCount to generateAdjacentDungeon', async () => {
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
    });

    it('passes corridorLength to generateAdjacentDungeon', async () => {
      const { generateAdjacentDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateAdjacentDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.click(screen.getByText('Sprawling (long halls)'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Adjacent Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateAdjacentDungeon).toHaveBeenCalled();
      });
      const callArgs = generateAdjacentDungeon.mock.calls[0][0];
      expect(callArgs.corridorLength).toBe('sprawling');
    });

    it('passes layoutStyle to generateAdjacentDungeon', async () => {
      const { generateAdjacentDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateAdjacentDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.click(screen.getByText('Linear'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Adjacent Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateAdjacentDungeon).toHaveBeenCalled();
      });
      const callArgs = generateAdjacentDungeon.mock.calls[0][0];
      expect(callArgs.layoutStyle).toBe('linear');
    });

    it('passes cramped sizeMultiplier to generateAdjacentDungeon', async () => {
      const { generateAdjacentDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateAdjacentDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.click(screen.getByText('Cramped'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Adjacent Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateAdjacentDungeon).toHaveBeenCalled();
      });
      const callArgs = generateAdjacentDungeon.mock.calls[0][0];
      expect(callArgs.minRoom).toBe(Math.max(3, Math.floor(Math.max(4, Math.floor(30 / 8)) * 0.7)));
      expect(callArgs.maxRoom).toBe(Math.max(6, Math.floor(Math.max(8, Math.min(18, Math.floor(30 / 2.5))) * 0.7)));
    });

    it('passes spacious sizeMultiplier to generateAdjacentDungeon', async () => {
      const { generateAdjacentDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateAdjacentDungeon.mockClear();
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.click(screen.getByText('Spacious'));
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Adjacent Dungeon' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      await waitFor(() => {
        expect(generateAdjacentDungeon).toHaveBeenCalled();
      });
      const callArgs = generateAdjacentDungeon.mock.calls[0][0];
      expect(callArgs.minRoom).toBe(Math.max(3, Math.floor(Math.max(4, Math.floor(30 / 8)) * 1.3)));
      expect(callArgs.maxRoom).toBe(Math.max(6, Math.floor(Math.max(8, Math.min(18, Math.floor(30 / 2.5))) * 1.3)));
    });

    it('passes standard sizeMultiplier to generateAdjacentDungeon', async () => {
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
      expect(callArgs.minRoom).toBe(Math.max(3, Math.floor(Math.max(4, Math.floor(30 / 8)) * 1)));
      expect(callArgs.maxRoom).toBe(Math.max(6, Math.floor(Math.max(8, Math.min(18, Math.floor(30 / 2.5))) * 1)));
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
    it('calls createMap with campaign name and map data', async () => {
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

  describe('generation disabled states', () => {
    it('disables generate button during generation', async () => {
      let resolve;
      mapsService.createMap.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      expect(screen.getByText('Generating...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Generating...' })).toBeDisabled();
      resolve();
    });

    it('disables cancel button during generation', async () => {
      let resolve;
      mapsService.createMap.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      resolve();
    });
  });
});
