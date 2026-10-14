// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateTerrainModal from './GenerateTerrainModal.jsx';

const { terrainMocks, mapsServiceMocks } = vi.hoisted(() => ({
  terrainMocks: {
    generateHexTerrain: vi.fn(() => ({ terrain: {} })),
  },
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

const getGenerateButton = () =>
  screen.getByRole('button', { name: 'Generate' });

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

  // Render, fill the form (defaults leave fields untouched), and generate.
  const generateWith = ({ name = 'Test', gridSize, seed } = {}) => {
    render(<GenerateTerrainModal {...props} />);
    typeMapName(name);
    if (gridSize !== undefined) setGridSize(gridSize);
    if (seed !== undefined) setSeed(seed);
    clickGenerate();
  };

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  describe('rendering', () => {
    it('renders title, name and seed inputs, default grid size, hex count hint, and helper text', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByRole('heading', { name: 'Generate Terrain Map' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. The Wild Frontier')).toBeInTheDocument();
      expect(screen.getByLabelText('Seed (optional)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      expect(screen.getByText(/30 hexes/)).toBeInTheDocument();
      expect(screen.getByText(/fractal noise/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(getGenerateButton()).toBeInTheDocument();
    });

    it('pre-fills the map name from initialMapName', () => {
      render(<GenerateTerrainModal {...props} initialMapName="My Terrain" />);
      expect(screen.getByDisplayValue('My Terrain')).toBeInTheDocument();
    });

    it('updates the hex count hint when the grid size changes', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByText(/1800 hexes/)).toBeInTheDocument();
      setGridSize('50');
      expect(screen.getByText(/5000 hexes/)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Cancel behavior
  // -------------------------------------------------------------------------
  describe('cancel', () => {
    it('calls onClose without creating a map', () => {
      render(<GenerateTerrainModal {...props} />);
      clickCancel();
      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
    });

    it('does not close when the overlay background is clicked', () => {
      render(<GenerateTerrainModal {...props} />);
      fireEvent.click(screen.getByRole('heading', { name: 'Generate Terrain Map' }).closest('.maps-manager-modal-overlay'));
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Generation flow
  // -------------------------------------------------------------------------
  describe('generation flow', () => {
    const untouched = { name: 'Test', gridSize: 30, seed: undefined };

    it('is disabled until the map name has content', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(getGenerateButton()).toBeDisabled();
      typeMapName('Test');
      expect(getGenerateButton()).toBeEnabled();
    });

    it.each([
      ['untouched defaults', {}, untouched],
      ['typed grid size and seed', { gridSize: '50', seed: '42' }, { name: 'Test', gridSize: 50, seed: 42 }],
      ['grid size clamped to the minimum of 30', { gridSize: '10' }, untouched],
      ['grid size clamped to the maximum of 100', { gridSize: '150' }, { ...untouched, gridSize: 100 }],
      ['whitespace trimmed from the name', { name: '  Trimmed  ' }, { ...untouched, name: 'Trimmed' }],
    ])('passes %s through to terrain generation and createMap', async (_label, inputs, expected) => {
      generateWith(inputs);
      await waitFor(() => {
        expect(terrainMocks.generateHexTerrain).toHaveBeenCalledWith({
          gridSize: expected.gridSize,
          seed: expected.seed,
        });
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith('test-campaign', expected.name, {
          type: 'outdoor',
          gridSize: expected.gridSize,
          terrain: {},
          pois: [],
        });
      });
    });

    it('notifies onMapCreated then closes on success', async () => {
      generateWith();
      await waitFor(() => {
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('disables both buttons and shows Generating... while createMap is pending', async () => {
      let resolveCreate;
      mapsServiceMocks.createMap.mockImplementationOnce(
        () => new Promise((resolve) => { resolveCreate = resolve; }),
      );
      generateWith();

      expect(await screen.findByRole('button', { name: 'Generating...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      resolveCreate({});
      await waitFor(() => {
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it.each([
      ['terrain generation throws', () => terrainMocks.generateHexTerrain.mockImplementationOnce(() => { throw new Error('Boom'); }), 'Boom'],
      ['createMap rejects', () => mapsServiceMocks.createMap.mockRejectedValueOnce(new Error('Save failed')), 'Save failed'],
    ])('shows the error, stays open, and succeeds on retry when %s', async (_label, arrange, message) => {
      arrange();
      generateWith();

      await screen.findByText(message);
      expect(props.onMapCreated).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
      expect(getGenerateButton()).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();

      clickGenerate();
      await waitFor(() => {
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('shows a default message when the error has no message', async () => {
      terrainMocks.generateHexTerrain.mockImplementationOnce(() => { throw new Error(); });
      generateWith();
      await screen.findByText('Failed to generate terrain');
    });
  });
});
