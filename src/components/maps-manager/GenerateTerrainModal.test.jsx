import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateTerrainModal from './GenerateTerrainModal.jsx';
import { generateHexTerrain } from '../../services/hexTerrainGenerator.js';
import * as mapsService from '../../services/mapsService.js';

vi.mock('../../services/hexTerrainGenerator.js', () => ({
  generateHexTerrain: vi.fn(() => ({
    terrain: [],
  })),
}));

vi.mock('../../services/mapsService.js', () => ({
  createMap: vi.fn(() => Promise.resolve()),
}));

describe('GenerateTerrainModal', () => {
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
    render(<GenerateTerrainModal {...props} />);
    expect(screen.getByText('Generate Terrain Map')).toBeInTheDocument();
  });

  it('should render map name input', () => {
    render(<GenerateTerrainModal {...props} />);
    expect(screen.getByPlaceholderText('e.g. The Wild Frontier')).toBeInTheDocument();
  });

  it('should pre-fill map name from initialMapName', () => {
    render(<GenerateTerrainModal {...props} initialMapName="My Terrain" />);
    expect(screen.getByDisplayValue('My Terrain')).toBeInTheDocument();
  });

  it('should render grid size input with default value', () => {
    render(<GenerateTerrainModal {...props} />);
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  it('should render seed input', () => {
    render(<GenerateTerrainModal {...props} />);
    expect(screen.getByPlaceholderText('Random')).toBeInTheDocument();
  });

  it('should disable generate button when map name is empty', () => {
    render(<GenerateTerrainModal {...props} />);
    const btn = screen.getByText('Generate').closest('button');
    expect(btn.disabled).toBe(true);
  });

  it('should enable generate button when map name is entered', () => {
    render(<GenerateTerrainModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
      target: { value: 'Wild Frontier' },
    });
    const btn = screen.getByText('Generate').closest('button');
    expect(btn.disabled).toBe(false);
  });

  it('should disable generate button when name is empty', () => {
    render(<GenerateTerrainModal {...props} />);
    const btn = document.querySelector('.dungeon-gen-generate-btn');
    expect(btn.disabled).toBe(true);
  });

  it('should enable generate button when name is provided', () => {
    render(<GenerateTerrainModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
      target: { value: 'Test Map' },
    });
    const btn = document.querySelector('.dungeon-gen-generate-btn');
    expect(btn.disabled).toBe(false);
  });

  it('should call generateHexTerrain and createMap on generate', async () => {
    render(<GenerateTerrainModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
      target: { value: 'Test Terrain' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    await vi.waitFor(() => {
      expect(generateHexTerrain).toHaveBeenCalledWith({ gridSize: 30, seed: undefined });
      expect(mapsService.createMap).toHaveBeenCalled();
    });
  });

  it('should pass seed as integer when provided', async () => {
    render(<GenerateTerrainModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('Random'), {
      target: { value: '42' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    await vi.waitFor(() => {
      expect(generateHexTerrain).toHaveBeenCalledWith({ gridSize: 30, seed: 42 });
    });
  });

  it('should call onMapCreated and onClose after successful generation', async () => {
    render(<GenerateTerrainModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    await vi.waitFor(() => {
      expect(props.onMapCreated).toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  it('should show error when generation fails', async () => {
    generateHexTerrain.mockImplementationOnce(() => { throw new Error('Terrain failed'); });
    render(<GenerateTerrainModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    await vi.waitFor(() => {
      expect(screen.getByText('Terrain failed')).toBeInTheDocument();
    });
  });

  it('should call onClose when Cancel clicked', () => {
    render(<GenerateTerrainModal {...props} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should call onClose when overlay clicked', () => {
    render(<GenerateTerrainModal {...props} />);
    const overlay = document.querySelector('.maps-manager-modal-overlay');
    fireEvent.click(overlay);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should show generating state during generation', async () => {
    let resolve;
    mapsService.createMap.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    render(<GenerateTerrainModal {...props} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Generate').closest('button'));
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    resolve();
  });

  it('should show grid size hint', () => {
    render(<GenerateTerrainModal {...props} />);
    expect(screen.getByText(/30 hexes/)).toBeInTheDocument();
  });

  it('should show terrain generation note', () => {
    render(<GenerateTerrainModal {...props} />);
    expect(screen.getByText(/fractal noise/)).toBeInTheDocument();
  });
});
