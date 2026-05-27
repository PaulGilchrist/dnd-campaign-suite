import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateDungeonModal from './GenerateDungeonModal.jsx';
import { generateDungeon } from '../../services/dungeonGenerator.js';
import * as mapsService from '../../services/mapsService.js';

vi.mock('../../services/dungeonGenerator.js', () => ({
  generateDungeon: vi.fn(() => ({
    name: 'test-dungeon',
    gridSize: 30,
    walls: [],
    doors: [],
  })),
}));

vi.mock('../../services/mapsService.js', () => ({
  createMap: vi.fn(() => Promise.resolve()),
}));

describe('GenerateDungeonModal', () => {
  let props;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      campaignName: 'test-campaign',
      initialMapName: '',
      onClose: vi.fn(),
      onMapCreated: vi.fn(),
    };
  });

  it('should render modal with title', () => {
    render(<GenerateDungeonModal {...props} />);
    expect(screen.getByText('Generate Dungeon Map')).toBeInTheDocument();
  });

  it('should render map name input', () => {
    render(<GenerateDungeonModal {...props} />);
    expect(screen.getByPlaceholderText('e.g. Goblin Hideout')).toBeInTheDocument();
  });

  it('should pre-fill map name from initialMapName', () => {
    render(<GenerateDungeonModal {...props} initialMapName="My Dungeon" />);
    expect(screen.getByDisplayValue('My Dungeon')).toBeInTheDocument();
  });

  it('should render grid size input with default value', () => {
    render(<GenerateDungeonModal {...props} />);
    const inputs = screen.getAllByDisplayValue('30');
    expect(inputs[0]).toBeInTheDocument();
    expect(inputs[0].type).toBe('number');
  });

  it('should render density slider', () => {
    render(<GenerateDungeonModal {...props} />);
    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe('50');
  });

  it('should render seed input', () => {
    render(<GenerateDungeonModal {...props} />);
    expect(screen.getByPlaceholderText('Random if empty')).toBeInTheDocument();
  });

  it('should disable generate button when map name is empty', () => {
    render(<GenerateDungeonModal {...props} />);
    const btn = screen.getByText('Generate').closest('button');
    expect(btn.disabled).toBe(true);
  });

  it('should enable generate button when map name is entered', () => {
    render(<GenerateDungeonModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), {
      target: { value: 'My Dungeon' },
    });
    const btn = screen.getByText('Generate').closest('button');
    expect(btn.disabled).toBe(false);
  });

  it('should call generateDungeon and createMap on generate', async () => {
    render(<GenerateDungeonModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), {
      target: { value: 'Goblin Hideout' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    await vi.waitFor(() => {
      expect(generateDungeon).toHaveBeenCalled();
      expect(mapsService.createMap).toHaveBeenCalled();
    });
  });

  it('should call onMapCreated and onClose after successful generation', async () => {
    render(<GenerateDungeonModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), {
      target: { value: 'Goblin Hideout' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    await vi.waitFor(() => {
      expect(props.onMapCreated).toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  it('should show error when generation fails', async () => {
    generateDungeon.mockImplementationOnce(() => { throw new Error('Gen failed'); });
    render(<GenerateDungeonModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    await vi.waitFor(() => {
      expect(screen.getByText('Gen failed')).toBeInTheDocument();
    });
  });

  it('should call onClose when Cancel clicked', () => {
    render(<GenerateDungeonModal {...props} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should call onClose when overlay clicked', () => {
    render(<GenerateDungeonModal {...props} />);
    const overlay = document.querySelector('.maps-manager-modal-overlay');
    fireEvent.click(overlay);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should show generating state during generation', async () => {
    let resolve;
    mapsService.createMap.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    render(<GenerateDungeonModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Goblin Hideout'), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    resolve();
  });

  it('should show grid size hint', () => {
    render(<GenerateDungeonModal {...props} />);
    expect(screen.getByText(/30 ft/)).toBeInTheDocument();
  });
});
