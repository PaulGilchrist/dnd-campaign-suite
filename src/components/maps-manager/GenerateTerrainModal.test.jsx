// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateTerrainModal from './GenerateTerrainModal.jsx';

const { terrainMocks } = vi.hoisted(() => ({
  terrainMocks: {
    generateHexTerrain: vi.fn(() => ({ terrain: {} })),
  },
}));

const { mapsServiceMocks } = vi.hoisted(() => ({
  mapsServiceMocks: {
    createMap: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../services/maps/hexTerrainGenerator.js', () => terrainMocks);
vi.mock('../../services/maps/mapsService.js', () => mapsServiceMocks);

// ---------------------------------------------------------------------------
// Interaction helpers
// ---------------------------------------------------------------------------
const typeMapName = (name) =>
  fireEvent.change(screen.getByPlaceholderText('e.g. The Wild Frontier'), {
    target: { value: name },
  });

const setGridSize = (value) =>
  fireEvent.change(screen.getByLabelText(/Grid Size/), { target: { value } });

const setSeed = (value) =>
  fireEvent.change(screen.getByPlaceholderText('Random'), { target: { value } });

const clickGenerate = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

const clickCancel = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

// Robust overlay finder: starts from a known element inside the modal and
// walks up to the overlay ancestor, avoiding raw document.querySelector.
const findOverlay = () =>
  screen.getByRole('heading', { name: 'Generate Terrain Map' })
    .closest('.maps-manager-modal-overlay');

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

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  describe('rendering', () => {
    it('renders the modal with title, inputs, grid size, hex count hint, and helper text', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByText('Generate Terrain Map')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. The Wild Frontier')).toBeInTheDocument();
      expect(screen.getByLabelText('Seed (optional)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      expect(screen.getByText(/30 hexes/)).toBeInTheDocument();
      expect(screen.getByText(/fractal noise/)).toBeInTheDocument();
    });

    it('pre-fills the map name from initialMapName', () => {
      render(<GenerateTerrainModal {...props} initialMapName="My Terrain" />);
      expect(screen.getByDisplayValue('My Terrain')).toBeInTheDocument();
    });

    it('renders Cancel and Generate buttons', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Generate button disabled state
  // -------------------------------------------------------------------------
  describe('generate button state', () => {
    it('is disabled when the map name is empty', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    });

    it('is enabled when the map name has content', () => {
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test');
      expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });
  });

  // -------------------------------------------------------------------------
  // Cancel behavior
  // -------------------------------------------------------------------------
  describe('cancel', () => {
    it('calls onClose when Cancel is clicked', () => {
      render(<GenerateTerrainModal {...props} />);
      clickCancel();
      expect(props.onClose).toHaveBeenCalled();
    });

    it('does not call onClose when the overlay background is clicked', () => {
      render(<GenerateTerrainModal {...props} />);
      fireEvent.click(findOverlay());
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Generate Terrain Map')).toBeInTheDocument();
    });

    it('does not close when clicking inside the modal content', () => {
      render(<GenerateTerrainModal {...props} />);
      fireEvent.click(screen.getByText('Generate Terrain Map'));
      expect(props.onClose).not.toHaveBeenCalled();
    });

  });

  // -------------------------------------------------------------------------
  // Grid size
  // -------------------------------------------------------------------------
  describe('grid size', () => {
    it.each([
      ['defaults to 30 when untouched', null, 30],
      ['uses the typed value when within range', '50', 50],
      ['clamps to the minimum of 30 when below range', '10', 30],
      ['clamps to the maximum of 100 when above range', '150', 100],
    ])('grid size %s', async (_label, typedValue, expectedGridSize) => {
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test');
      if (typedValue !== null) setGridSize(typedValue);
      clickGenerate();
      await waitFor(() => {
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith(
          'test-campaign',
          'Test',
          expect.objectContaining({ gridSize: expectedGridSize }),
        );
      });
    });

    it('updates the hex count hint when the grid size changes', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByText(/30 hexes/)).toBeInTheDocument();
      setGridSize('50');
      expect(screen.getByText(/50 hexes/)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Seed handling
  // -------------------------------------------------------------------------
  describe('seed handling', () => {
    it.each([
      ['passes the typed seed as an integer', '42', 42],
      ['passes undefined when the seed is left empty', '', undefined],
    ])('seed %s', async (_label, typedSeed, expectedSeed) => {
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test');
      setSeed(typedSeed);
      clickGenerate();
      await waitFor(() => {
        const callArgs = terrainMocks.generateHexTerrain.mock.calls[0][0];
        expect(callArgs.seed).toBe(expectedSeed);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Generation flow
  // -------------------------------------------------------------------------
  describe('generation flow', () => {
    it('creates the map with outdoor defaults then notifies and closes', async () => {
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test Terrain');
      clickGenerate();

      await waitFor(() => {
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith(
          'test-campaign',
          'Test Terrain',
          expect.objectContaining({ type: 'outdoor', gridSize: 30, pois: [], terrain: {} }),
        );
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('trims the map name before creating the map', async () => {
      render(<GenerateTerrainModal {...props} />);
      typeMapName('  Trimmed  ');
      clickGenerate();

      await waitFor(() => {
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith(
          expect.any(String),
          'Trimmed',
          expect.any(Object),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // During generation
  // -------------------------------------------------------------------------
  describe('during generation', () => {
    it('disables both buttons and shows Generating text while the map is being created', async () => {
      const pending = new Promise((resolve) => {
        terrainMocks.createMapPendingResolve = resolve;
      });
      mapsServiceMocks.createMap.mockImplementationOnce(() => pending);
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test');
      clickGenerate();

      const generateButton = await screen.findByRole('button', { name: 'Generating...' });
      expect(generateButton).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      terrainMocks.createMapPendingResolve({});
      await waitFor(() => {
        expect(props.onClose).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('shows the error and does not close when terrain generation throws', async () => {
      terrainMocks.generateHexTerrain.mockImplementationOnce(() => { throw new Error('Boom'); });
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('Boom')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
      expect(props.onMapCreated).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('shows a default message when the error has no message', async () => {
      terrainMocks.generateHexTerrain.mockImplementationOnce(() => { throw new Error(); });
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('Failed to generate terrain')).toBeInTheDocument();
      });
    });

    it('shows the error and does not close when createMap fails', async () => {
      mapsServiceMocks.createMap.mockRejectedValueOnce(new Error('Save failed'));
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });
      expect(props.onMapCreated).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('allows a successful retry after a terrain generation error', async () => {
      terrainMocks.generateHexTerrain.mockImplementationOnce(() => { throw new Error('First fail'); });
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Retry Test');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('First fail')).toBeInTheDocument();
      });

      clickGenerate();
      await waitFor(() => {
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('allows a successful retry after a createMap failure', async () => {
      mapsServiceMocks.createMap.mockRejectedValueOnce(new Error('Save failed'));
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Retry Test');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });

      clickGenerate();
      await waitFor(() => {
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });
  });
});
