// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateTerrainModal from './GenerateTerrainModal.jsx';

const { terrainMocks, mapsServiceMocks } = vi.hoisted(() => ({
  terrainMocks: {
    // Echoes the effective seed the way the real generator now does: the
    // typed seed when given (0 included), else a fixed stand-in for the
    // generator's internal random draw.
    generateHexTerrain: vi.fn((opts) => ({ terrain: {}, seed: opts?.seed ?? 98765 })),
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
    // docSeed = the seed the generator reports back, which must land in the
    // created map document (criteria 4/5: reproducible from disk).
    const untouched = { name: 'Test', gridSize: 30, seed: undefined, docSeed: 98765 };

    it('is disabled until the map name has content', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(getGenerateButton()).toBeDisabled();
      typeMapName('Test');
      expect(getGenerateButton()).toBeEnabled();
    });

    it.each([
      ['untouched defaults', {}, untouched],
      ['typed grid size and seed', { gridSize: '50', seed: '42' }, { name: 'Test', gridSize: 50, seed: 42, docSeed: 42 }],
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
          seed: expected.docSeed,
        });
      });
    });

    // TE backlog 2026-11-12: the silent clamp (Math.max(30, Math.min(100, n)))
    // is retired — an out-of-range, cleared (React-19: Number('') === 0), or
    // non-integer grid now BLOCKS with a persistent inline error aligned to
    // the real [30,100] gate, exactly like the dungeon twin: no generator
    // call, no createMap POST, modal stays open.
    it.each(['20', '101', '', '45.5'])(
      'blocks grid size "%s" with an inline error, no map created, modal stays open',
      async (typed) => {
        generateWith({ gridSize: typed });

        const error = await screen.findByText('Grid size must be between 30 and 100');
        expect(error).toHaveClass('maps-manager-error');
        expect(terrainMocks.generateHexTerrain).not.toHaveBeenCalled();
        expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
        expect(props.onMapCreated).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        // Persistent: still there after the beat, Generate re-enabled, field
        // preserved for fixing
        expect(screen.getByText('Grid size must be between 30 and 100')).toBeInTheDocument();
        expect(getGenerateButton()).toBeEnabled();
      },
    );

    it('recovers after correcting an out-of-range grid size', async () => {
      generateWith({ gridSize: '20' });
      expect(await screen.findByText('Grid size must be between 30 and 100')).toBeInTheDocument();

      setGridSize('40');
      clickGenerate();
      await waitFor(() => {
        expect(terrainMocks.generateHexTerrain).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 40 }),
        );
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith('test-campaign', 'Test',
          expect.objectContaining({ gridSize: 40 }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });

    // In-range values pass through UNCLAMPED — the stored gridSize equals
    // what was typed, boundaries 30/100 included (no silent 30-grid surprise).
    it.each(['30', '40', '100'])(
      'passes grid size "%s" through to the generator and document unclamped',
      async (typed) => {
        generateWith({ gridSize: typed });
        await waitFor(() => {
          expect(terrainMocks.generateHexTerrain).toHaveBeenCalledWith(
            expect.objectContaining({ gridSize: Number(typed) }),
          );
          expect(mapsServiceMocks.createMap).toHaveBeenCalledWith('test-campaign', 'Test',
            expect.objectContaining({ gridSize: Number(typed) }));
        });
        expect(screen.queryByText('Grid size must be between 30 and 100')).not.toBeInTheDocument();
      },
    );

    // TE backlog 2026-11-12: editing any of the three fields clears a stale
    // banner so it never lingers beside now-valid inputs mid-form.
    it.each([
      ['map name', () => typeMapName('Renamed')],
      ['grid size', () => setGridSize('40')],
      ['seed', () => setSeed('7')],
    ])('editing the %s field clears a stale error banner', async (_label, edit) => {
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Test');
      setGridSize('20');
      clickGenerate();

      const banner = 'Grid size must be between 30 and 100';
      expect(await screen.findByText(banner)).toBeInTheDocument();

      edit();
      expect(screen.queryByText(banner)).not.toBeInTheDocument();
    });

    // Criterion 3: seed "0" must drive the generator and be stored verbatim —
    // the old `parseInt(seed) || undefined` silently random-ized it.
    it('honours seed "0" through generation and into the map document', async () => {
      generateWith({ seed: '0' });
      await waitFor(() => {
        expect(terrainMocks.generateHexTerrain).toHaveBeenCalledWith({ gridSize: 30, seed: 0 });
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith('test-campaign', 'Test',
          expect.objectContaining({ seed: 0 }));
      });
    });

    // Criterion 2: a non-numeric seed blocks generation with a persistent
    // inline error (no silent random fallback), and a fixed seed succeeds.
    it.each(['abc', '4.5', '12abc'])(
      'blocks seed "%s" with an inline error, no map created, and recovers after a fix',
      async (typedSeed) => {
        generateWith({ seed: typedSeed });

        const error = await screen.findByText('Seed must be a whole number');
        expect(error).toHaveClass('maps-manager-error');
        expect(terrainMocks.generateHexTerrain).not.toHaveBeenCalled();
        expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
        expect(props.onMapCreated).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.getByDisplayValue(typedSeed)).toBeInTheDocument();
        expect(getGenerateButton()).toBeEnabled();

        setSeed('7');
        clickGenerate();
        await waitFor(() => {
          expect(terrainMocks.generateHexTerrain).toHaveBeenCalledWith(
            expect.objectContaining({ seed: 7 }),
          );
          expect(props.onClose).toHaveBeenCalledTimes(1);
        });
      },
    );

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
