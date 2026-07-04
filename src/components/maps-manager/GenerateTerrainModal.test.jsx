// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GenerateTerrainModal from './GenerateTerrainModal.jsx';
import { generateHexTerrain } from '../../services/maps/hexTerrainGenerator.js';
import * as mapsService from '../../services/maps/mapsService.js';

vi.mock('../../services/maps/hexTerrainGenerator.js', () => ({
  generateHexTerrain: vi.fn(() => ({
    terrain: [],
  })),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  createMap: vi.fn(() => Promise.resolve()),
}));

describe('GenerateTerrainModal', () => {
  let props;

  beforeEach(() => {
    props = {
      campaignName: 'test-campaign',
      initialMapName: '',
      onClose: vi.fn(),
      onMapCreated: vi.fn(),
    };
  });

  describe('rendering', () => {
    it('should render modal with title, inputs, and hints', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByText('Generate Terrain Map')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. The Wild Frontier')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Random')).toBeInTheDocument();
      expect(screen.getByText(/30 hexes/)).toBeInTheDocument();
      expect(screen.getByText(/fractal noise/)).toBeInTheDocument();
    });

    it('should pre-fill map name from initialMapName', () => {
      render(<GenerateTerrainModal {...props} initialMapName="My Terrain" />);
      expect(screen.getByDisplayValue('My Terrain')).toBeInTheDocument();
    });
  });

  describe('generate button state', () => {
    const getGenerateButton = () => screen.getByRole('button', { name: /generate/i });

    it('should be disabled when map name is empty', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(getGenerateButton()).toHaveAttribute('disabled');
    });

    it('should be enabled when map name is entered', () => {
      render(<GenerateTerrainModal {...props} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
        target: { value: 'Wild Frontier' },
      });
      expect(getGenerateButton()).not.toHaveAttribute('disabled');
    });
  });

  describe('closing the modal', () => {
    it('should call onClose when Cancel clicked or overlay clicked', () => {
      const { container } = render(<GenerateTerrainModal {...props} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(props.onClose).toHaveBeenCalledTimes(1);

      props.onClose.mockClear();
      const overlay = container.querySelector('[class*="overlay"]');
      fireEvent.click(overlay);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('terrain generation', () => {
    it('should call generateHexTerrain and createMap on generate, then close', async () => {
      render(<GenerateTerrainModal {...props} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
        target: { value: 'Test Terrain' },
      });
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      await vi.waitFor(() => {
        expect(generateHexTerrain).toHaveBeenCalledWith({ gridSize: 30, seed: undefined });
        expect(mapsService.createMap).toHaveBeenCalled();
        expect(props.onMapCreated).toHaveBeenCalled();
        expect(props.onClose).toHaveBeenCalled();
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
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      await vi.waitFor(() => {
        expect(generateHexTerrain).toHaveBeenCalledWith({ gridSize: 30, seed: 42 });
      });
    });

    it('should show error when generation fails', async () => {
      generateHexTerrain.mockImplementationOnce(() => { throw new Error('Terrain failed'); });
      render(<GenerateTerrainModal {...props} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      await vi.waitFor(() => {
        expect(screen.getByText('Terrain failed')).toBeInTheDocument();
      });
    });
  });
});
