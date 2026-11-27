// @maintained-by-ai 2026-11-26
// GenerateTerrainModal.test.jsx — modal-WIRING pins for the terrain twin.
// Ownership lines (2026-11-26 maintenance, mirroring GenerateDungeonModal):
//  - grid/seed value-space is pinned in gridInput.test.js / seedInput.test.js;
//    these tests only sample one out-of-range value plus the blank-field
//    (Number('') === 0) nuance to prove the modal's block-and-recover wiring.
//  - the body-targeted Escape rescue lane and once-only firing are pinned in
//    useModalDismiss.escape-body-focus.test.jsx; here we only prove THIS modal
//    attaches the handlers and feeds `disabled: generating` into them.
//  - twin class/copy parity (seed placeholder, shared tokens) lives in
//    generateModalParity.test.js.
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
// Interaction helpers (label-scoped: field copy like the shared seed
// placeholder is not this file's contract to pin)
// ---------------------------------------------------------------------------
const typeMapName = (name) =>
  fireEvent.change(screen.getByLabelText(/Map Name/), { target: { value: name } });

const setGridSize = (value) =>
  fireEvent.change(screen.getByLabelText(/Grid Size/), { target: { value } });

const setSeed = (value) =>
  fireEvent.change(screen.getByLabelText(/Seed/), { target: { value } });

const clickGenerate = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

const getGenerateButton = () =>
  screen.getByRole('button', { name: 'Generate' });

const GRID_BANNER = 'Grid size must be between 30 and 100';
const SEED_BANNER = 'Seed must be a whole number';

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
    it('renders title, labelled fields, default grid size, hex count hint, note copy, and action buttons', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByRole('heading', { name: 'Generate Terrain Map' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Map Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Seed/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Grid Size/)).toHaveValue(30);
      expect(screen.getByText(/30 hexes/)).toBeInTheDocument();
      expect(screen.getByText(/fractal noise/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(getGenerateButton()).toBeInTheDocument();
    });

    it('pre-fills the map name from initialMapName', () => {
      render(<GenerateTerrainModal {...props} initialMapName="My Terrain" />);
      expect(screen.getByLabelText(/Map Name/)).toHaveValue('My Terrain');
    });

    it('updates the hex count hint when the grid size changes', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(screen.getByText(/1800 hexes/)).toBeInTheDocument();
      setGridSize('50');
      expect(screen.getByText(/5000 hexes/)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // F11 family law (Item 7): shared useModalDismiss Escape/backdrop close,
  // blocked while generating. Lane mechanics live in the hook's own tests —
  // these prove THIS modal wires the handlers.
  // -------------------------------------------------------------------------
  describe('dismissal wiring (useModalDismiss lane)', () => {
    it('closes via Cancel and a pure backdrop click, not a panel click, without creating a map', () => {
      render(<GenerateTerrainModal {...props} />);
      const panel = document.querySelector('.maps-manager-modal');
      const overlay = panel.closest('.maps-manager-modal-overlay');

      fireEvent.mouseDown(panel);
      fireEvent.click(panel);
      expect(props.onClose).not.toHaveBeenCalled();

      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);
      expect(props.onClose).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(props.onClose).toHaveBeenCalledTimes(2);
      expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
    });

    it('Escape on the overlay closes', () => {
      render(<GenerateTerrainModal {...props} />);
      fireEvent.keyDown(document.querySelector('.maps-manager-modal-overlay'), { key: 'Escape' });
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('Escape is inert while a generation is in flight, then the map still closes cleanly', async () => {
      let release;
      mapsServiceMocks.createMap.mockImplementationOnce(() => new Promise((res) => { release = res; }));
      render(<GenerateTerrainModal {...props} />);
      typeMapName('Hex');
      clickGenerate();
      await waitFor(() => expect(terrainMocks.generateHexTerrain).toHaveBeenCalled());

      fireEvent.keyDown(document.querySelector('.maps-manager-modal-overlay'), { key: 'Escape' });
      expect(props.onClose).not.toHaveBeenCalled();

      release({});
      await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    });
  });

  // -------------------------------------------------------------------------
  // Generation flow
  // -------------------------------------------------------------------------
  describe('generation flow', () => {
    // docSeed = the seed the generator reports back, which must land in the
    // created map document (criteria 4/5: reproducible from disk).
    const untouched = { name: 'Test', gridSize: 30, seed: undefined, docSeed: 98765 };

    it('enables Generate only when the map name has non-whitespace content', () => {
      render(<GenerateTerrainModal {...props} />);
      expect(getGenerateButton()).toBeDisabled();
      typeMapName('   ');
      expect(getGenerateButton()).toBeDisabled();
      typeMapName('Test');
      expect(getGenerateButton()).toBeEnabled();
    });

    // Full create-body contract (UF backlog 2026-11-12): the document carries
    // the EFFECTIVE options — mode + typed grid + the generator's effective
    // seed (the random draw when the field was blank, echoed as docSeed) —
    // and success notifies onMapCreated before closing. The untouched case
    // doubles as the minimum-boundary (30) unclamped pass.
    it.each([
      ['untouched defaults', {}, untouched],
      ['typed grid size and seed', { gridSize: '50', seed: '42' }, { name: 'Test', gridSize: 50, seed: 42, docSeed: 42 }],
      ['whitespace trimmed from the name', { name: '  Trimmed  ' }, { ...untouched, name: 'Trimmed' }],
    ])('passes %s through to terrain generation and createMap, then notifies and closes', async (_label, inputs, expected) => {
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
          generationOpts: {
            mode: 'terrain',
            gridSize: expected.gridSize,
            seed: expected.docSeed,
          },
        });
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });

    // The silent clamp (Math.max(30, ...)) is retired (TE backlog 2026-11-12):
    // a bad grid BLOCKS with a persistent inline error, exactly like the
    // dungeon twin. The full value-space (101, 45.5, NaN) is pinned in
    // gridInput.test.js; these two sample the modal wiring: out-of-range and
    // the blank field (React-19: Number('') === 0) that used to slip past.
    it.each(['20', ''])(
      'blocks grid size "%s" with an inline error and no map created, modal stays open',
      async (typed) => {
        generateWith({ gridSize: typed });

        const error = await screen.findByText(GRID_BANNER);
        expect(error).toHaveClass('maps-manager-error');
        expect(terrainMocks.generateHexTerrain).not.toHaveBeenCalled();
        expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
        expect(props.onMapCreated).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        // Persistent and recoverable: Generate stays enabled, the field keeps
        // the offending value for fixing (blank reads as 0).
        expect(getGenerateButton()).toBeEnabled();
        expect(screen.getByLabelText(/Grid Size/)).toHaveValue(Number(typed));
      },
    );

    // The maximum boundary passes through UNCLAMPED — the stored gridSize
    // equals what was typed (no silent 30-grid surprise). The minimum (30)
    // unclamped face is the untouched-defaults case above; the error→fix→
    // success recovery face is pinned by the seed-gate test below.
    it('passes the boundary grid size 100 through unclamped', async () => {
      generateWith({ gridSize: '100' });
      await waitFor(() => {
        expect(terrainMocks.generateHexTerrain).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 100 }),
        );
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith('test-campaign', 'Test',
          expect.objectContaining({
            gridSize: 100,
            generationOpts: expect.objectContaining({ gridSize: 100 }),
          }));
      });
      expect(screen.queryByText(GRID_BANNER)).not.toBeInTheDocument();
    });

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

      expect(await screen.findByText(GRID_BANNER)).toBeInTheDocument();

      edit();
      expect(screen.queryByText(GRID_BANNER)).not.toBeInTheDocument();
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

    // Criterion 2 (seedInput.js owns the value-space; these two sample it):
    // a non-numeric seed blocks with a persistent inline error (no silent
    // random fallback) and a fixed seed then generates and closes — the
    // recovery face shared by both gates.
    it.each(['abc', '4.5'])(
      'blocks seed "%s" with an inline error, no map created, and recovers after a fix',
      async (typedSeed) => {
        generateWith({ seed: typedSeed });

        const error = await screen.findByText(SEED_BANNER);
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
