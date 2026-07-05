// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    it('renders modal with title, inputs, and hints', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByText('Generate Terrain Map')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. The Wild Frontier')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Random')).toBeInTheDocument();
      expect(screen.getByText(/30 hexes/)).toBeInTheDocument();
      expect(screen.getByText(/fractal noise/)).toBeInTheDocument();
    });

    it('pre-fills map name from initialMapName prop', () => {
      render(<GenerateTerrainModal {...props} initialMapName="My Terrain" />);
      expect(screen.getByDisplayValue('My Terrain')).toBeInTheDocument();
    });
  });

  describe('generate button', () => {
    const getGenerateButton = () => screen.getByRole('button', { name: /generate/i });

    it('is disabled until map name is entered', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(getGenerateButton()).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
        target: { value: 'Wild Frontier' },
      });
      expect(getGenerateButton()).not.toBeDisabled();
    });
  });

  describe('terrain generation', () => {
    it('calls createMap and closes on successful generation', async () => {
      render(<GenerateTerrainModal {...props} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
        target: { value: 'Test Terrain' },
      });
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      await waitFor(() => {
        expect(mapsService.createMap).toHaveBeenCalled();
        expect(props.onMapCreated).toHaveBeenCalled();
        expect(props.onClose).toHaveBeenCalled();
      });
    });

    it('shows error when generation fails', async () => {
      generateHexTerrain.mockImplementationOnce(() => { throw new Error('Terrain failed'); });
      render(<GenerateTerrainModal {...props} />);
      fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
        target: { value: 'Test' },
      });
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));
      await waitFor(() => {
        expect(screen.getByText('Terrain failed')).toBeInTheDocument();
      });
    });
  });
});
