import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateDungeonModal from './GenerateDungeonModal';

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal title', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    expect(screen.getByText('Generate Dungeon Map')).toBeInTheDocument();
  });

  it('renders map name input', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    expect(screen.getByPlaceholderText('e.g. Goblin Hideout')).toBeInTheDocument();
  });

  it('renders mode selector with BSP option', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    expect(screen.getByText('BSP Dungeon')).toBeInTheDocument();
  });

  it('renders mode selector with Room Adjacent option', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    expect(screen.getByText('Room Adjacent')).toBeInTheDocument();
  });

  it('has BSP mode selected by default', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    const bspBtn = screen.getByText('BSP Dungeon').closest('button');
    expect(bspBtn).toHaveClass('active');
  });

  it('renders grid size input for BSP mode', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    const gridInputs = screen.getAllByRole('spinbutton');
    expect(gridInputs.length).toBeGreaterThan(0);
  });

  it('renders density slider for BSP mode', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    const densitySlider = screen.getByRole('slider');
    expect(densitySlider).toBeInTheDocument();
  });

  it('shows density hint text', () => {
    const { container } = render(<GenerateDungeonModal {...defaultProps} />);
    expect(container.textContent).toContain('Moderate');
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
    const generateBtn = screen.getByRole('button', { name: 'Generate' });
    expect(generateBtn).toBeInTheDocument();
  });

  it('generate button is disabled when map name is empty', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    const generateBtn = screen.getByRole('button', { name: 'Generate' });
    expect(generateBtn).toBeDisabled();
  });

  it('generate button is enabled when map name is provided', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'My Dungeon' } });
    const generateBtn = screen.getByRole('button', { name: 'Generate' });
    expect(generateBtn).not.toBeDisabled();
  });

  it('calls onClose when cancel button clicked', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows error message on generate failure', async () => {
    const { container } = render(<GenerateDungeonModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), { target: { value: 'My Dungeon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => {
      expect(container.textContent).toContain('Generating');
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

  it('switches to adjacent mode', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Room Adjacent'));
    const adjacentBtn = screen.getByText('Room Adjacent').closest('button');
    expect(adjacentBtn).toHaveClass('active');
  });

  it('density slider updates display', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('50');
  });

  it('room count slider updates display', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Room Adjacent'));
    const roomSlider = screen.getByRole('slider');
    expect(roomSlider).toBeInTheDocument();
  });

  it('renders note text', () => {
    const { container } = render(<GenerateDungeonModal {...defaultProps} />);
    expect(container.textContent).toContain('starting point');
  });

  it('renders with initialMapName', () => {
    render(<GenerateDungeonModal {...defaultProps} initialMapName="Pre-filled Name" />);
    expect(screen.getByDisplayValue('Pre-filled Name')).toBeInTheDocument();
  });

  it('selects room size option', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Room Adjacent'));
    fireEvent.click(screen.getByText('Cramped'));
    const crampedBtn = screen.getByText('Cramped').closest('button');
    expect(crampedBtn).toHaveClass('active');
  });

  it('selects corridor length option', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Room Adjacent'));
    fireEvent.click(screen.getByText('Compact (rooms adjacent)'));
    const compactBtn = screen.getByText('Compact (rooms adjacent)').closest('button');
    expect(compactBtn).toHaveClass('active');
  });

  it('selects layout style option', () => {
    render(<GenerateDungeonModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Room Adjacent'));
    fireEvent.click(screen.getByText('Linear'));
    const linearBtn = screen.getByText('Linear').closest('button');
    expect(linearBtn).toHaveClass('active');
  });

  it('overlay click calls onClose', () => {
    const { container } = render(<GenerateDungeonModal {...defaultProps} />);
    const overlay = container.querySelector('.maps-manager-modal-overlay');
    fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

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
});
