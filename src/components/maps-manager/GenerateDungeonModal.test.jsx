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
      expect(screen.getByText(/starting point/)).toBeInTheDocument();
      expect(screen.getByText('BSP Dungeon')).toBeInTheDocument();
      expect(screen.getByText('Room Adjacent')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
      expect(screen.getByText(/Moderate/)).toBeInTheDocument();
      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
      expect(screen.getByText('BSP Dungeon').closest('button')).toHaveClass('active');
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
    it('switches to adjacent mode and shows its controls', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      expect(screen.getByText('Room Adjacent').closest('button')).toHaveClass('active');
      expect(screen.getByText(/Room Count:/)).toBeInTheDocument();
      expect(screen.getByText('Cramped')).toBeInTheDocument();
      expect(screen.getByText('Standard')).toBeInTheDocument();
      expect(screen.getByText('Spacious')).toBeInTheDocument();
      expect(screen.getByText('Compact (rooms adjacent)')).toBeInTheDocument();
      expect(screen.getByText('Balanced')).toBeInTheDocument();
      expect(screen.getByText('Linear')).toBeInTheDocument();
    });

    it('selects room size, corridor length, and layout style options', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Room Adjacent'));
      fireEvent.click(screen.getByText('Cramped'));
      expect(screen.getByText('Cramped').closest('button')).toHaveClass('active');
      fireEvent.click(screen.getByText('Compact (rooms adjacent)'));
      expect(screen.getByText('Compact (rooms adjacent)').closest('button')).toHaveClass('active');
      fireEvent.click(screen.getByText('Linear'));
      expect(screen.getByText('Linear').closest('button')).toHaveClass('active');
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

  describe('BSP density hint', () => {
    it('shows density hint that changes with slider value', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText(/Moderate/)).toBeInTheDocument();
      fireEvent.change(screen.getByRole('slider'), { target: { value: '20' } });
      expect(screen.getByText(/Sparse/)).toBeInTheDocument();
      fireEvent.change(screen.getByRole('slider'), { target: { value: '80' } });
      expect(screen.getByText(/Dense/)).toBeInTheDocument();
    });
  });

  describe('grid size hint', () => {
    it('shows grid size hint that updates when grid size changes', () => {
      render(<GenerateDungeonModal {...defaultProps} />);
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
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

    it('passes density from slider to generateDungeon', async () => {
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
    it('calls generateAdjacentDungeon with correct params for each mode option', async () => {
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

    it('passes corridor length, layout style, and room size multipliers to generateAdjacentDungeon', async () => {
      const { generateAdjacentDungeon } = await import('../../services/maps/dungeonGenerator.js');
      generateAdjacentDungeon.mockClear();

      // Spacious room size, sprawling corridor, linear layout test
      {
        const { container } = render(<GenerateDungeonModal {...defaultProps} />);
        const modeBtns = container.querySelectorAll('.dungeon-gen-mode-btn');
        fireEvent.click(modeBtns[1]); // Room Adjacent
        const optionGroups = container.querySelectorAll('.dungeon-gen-option-group');
        const roomSizeBtns = optionGroups[0].querySelectorAll('.dungeon-gen-option-btn');
        const corridorBtns = optionGroups[1].querySelectorAll('.dungeon-gen-option-btn');
        const layoutBtns = optionGroups[2].querySelectorAll('.dungeon-gen-option-btn');
        fireEvent.click(roomSizeBtns[2]); // Spacious
        fireEvent.click(corridorBtns[2]); // Sprawling (long halls)
        fireEvent.click(layoutBtns[1]); // Linear
        fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'Adjacent Dungeon' } });
        fireEvent.click(container.querySelector('.dungeon-gen-generate-btn'));
        await waitFor(() => {
          expect(generateAdjacentDungeon).toHaveBeenCalled();
        });
        const callArgs = generateAdjacentDungeon.mock.calls[0][0];
        expect(callArgs.corridorLength).toBe('sprawling');
        expect(callArgs.layoutStyle).toBe('linear');
        expect(callArgs.minRoom).toBe(Math.max(3, Math.floor(Math.max(4, Math.floor(30 / 8)) * 1.3)));
        expect(callArgs.maxRoom).toBe(Math.max(6, Math.floor(Math.max(8, Math.min(18, Math.floor(30 / 2.5))) * 1.3)));
      }

      generateAdjacentDungeon.mockClear();

      // Cramped room size test
      {
        const { container } = render(<GenerateDungeonModal {...defaultProps} />);
        const modeBtns = container.querySelectorAll('.dungeon-gen-mode-btn');
        fireEvent.click(modeBtns[1]); // Room Adjacent
        const optionGroups = container.querySelectorAll('.dungeon-gen-option-group');
        const roomSizeBtns = optionGroups[0].querySelectorAll('.dungeon-gen-option-btn');
        fireEvent.click(roomSizeBtns[0]); // Cramped
        fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'Adjacent Dungeon' } });
        fireEvent.click(container.querySelector('.dungeon-gen-generate-btn'));
        await waitFor(() => {
          expect(generateAdjacentDungeon).toHaveBeenCalled();
        });
        const crampedArgs = generateAdjacentDungeon.mock.calls[0][0];
        expect(crampedArgs.minRoom).toBe(Math.max(3, Math.floor(Math.max(4, Math.floor(30 / 8)) * 0.7)));
        expect(crampedArgs.maxRoom).toBe(Math.max(6, Math.floor(Math.max(8, Math.min(18, Math.floor(30 / 2.5))) * 0.7)));
      }

      generateAdjacentDungeon.mockClear();

      // Standard (default) room size test
      {
        const { container } = render(<GenerateDungeonModal {...defaultProps} />);
        const modeBtns = container.querySelectorAll('.dungeon-gen-mode-btn');
        fireEvent.click(modeBtns[1]); // Room Adjacent
        fireEvent.change(container.querySelector('input[type="text"]'), { target: { value: 'Adjacent Dungeon' } });
        fireEvent.click(container.querySelector('.dungeon-gen-generate-btn'));
        await waitFor(() => {
          expect(generateAdjacentDungeon).toHaveBeenCalled();
        });
        const standardArgs = generateAdjacentDungeon.mock.calls[0][0];
        expect(standardArgs.minRoom).toBe(Math.max(3, Math.floor(Math.max(4, Math.floor(30 / 8)) * 1)));
        expect(standardArgs.maxRoom).toBe(Math.max(6, Math.floor(Math.max(8, Math.min(18, Math.floor(30 / 2.5))) * 1)));
      }
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
