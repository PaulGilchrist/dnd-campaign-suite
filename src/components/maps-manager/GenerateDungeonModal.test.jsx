// @maintained-by-ai 2026-11-26
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateDungeonModal from './GenerateDungeonModal';

const { dungeonMocks } = vi.hoisted(() => {
  const dungeonResult = {
    name: 'Test Dungeon',
    gridSize: 30,
    walls: [],
    placedItems: [],
    players: [],
    zoom: 1,
    panX: 0,
    panY: 0,
  };
  return {
    dungeonResult,
    dungeonMocks: {
      generateDungeon: vi.fn(() => ({ ...dungeonResult })),
      generateAdjacentDungeon: vi.fn(() => ({ ...dungeonResult })),
    },
  };
});

const { mapsServiceMocks } = vi.hoisted(() => ({
  mapsServiceMocks: {
    createMap: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../services/maps/dungeonGenerator.js', () => dungeonMocks);
vi.mock('../../services/maps/mapsService.js', () => mapsServiceMocks);

// ---------------------------------------------------------------------------
// Interaction helpers
// ---------------------------------------------------------------------------
const fillMapName = (name) =>
  fireEvent.change(screen.getByLabelText(/Map Name/), { target: { value: name } });

const clickGenerate = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

const selectMode = (modeLabel) =>
  fireEvent.click(screen.getByRole('button', { name: modeLabel }));

const changeField = (matcher, value) =>
  fireEvent.change(screen.getByLabelText(matcher), { target: { value } });

const setSlider = (nameMatcher, value) =>
  fireEvent.change(screen.getByRole('slider', { name: nameMatcher }), { target: { value } });

// Fill the name, run an optional per-case interaction, generate, and assert
// the generator received the expected options.
const submitAndExpect = async (generatorMock, expectedOptions, interact) => {
  fillMapName('Dungeon');
  if (interact) interact();
  clickGenerate();
  await waitFor(() => {
    expect(generatorMock).toHaveBeenCalledWith(expect.objectContaining(expectedOptions));
  });
};

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

// ---------------------------------------------------------------------------
// Test suite
//
// Division of labour (2026-11-26 trim): parseGridInput/parseSeedInput unit
// tests (gridInput.test.js, seedInput.test.js) own the gate value-space;
// useModalDismiss.escape-body-focus.test.jsx owns the shared Escape/backdrop
// law incl. the body-rescue lane; generateModalParity.test.js owns the shared
// tokens/placeholder. This file pins only what is unique to THIS modal:
// form wiring, option→generator-arg mapping, createMap payload stamping, and
// the in-flight gating it feeds the shared hook.
// ---------------------------------------------------------------------------
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

  describe('rendering', () => {
    // Copy pin (SD backlog 2026-11-12): the note reads "fleshed out", never
    // "flushed". Seed input is located by label, not placeholder text — the
    // placeholder is the shared SEED_INPUT_PLACEHOLDER constant's copy, owned
    // by seedInput.test.js and the parity pin.
    it('renders the title, name and seed fields, and the fixed note copy', () => {
      render(<GenerateDungeonModal {...props} />);
      expect(screen.getByText('Generate Dungeon Map')).toBeInTheDocument();
      expect(screen.getByLabelText(/Map Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Seed/)).toBeInTheDocument();
      expect(screen.getByText(
        'Note: This is meant to be just a starting point for you to finish into a fully fleshed out map',
      )).toBeInTheDocument();
      expect(screen.queryByText(/flushed/)).not.toBeInTheDocument();
    });

    it('pre-fills map name from initialMapName prop', () => {
      render(<GenerateDungeonModal {...props} initialMapName="Pre-filled Name" />);
      expect(screen.getByDisplayValue('Pre-filled Name')).toBeInTheDocument();
    });

    // The hint JSX is duplicated across both mode branches — this pins the
    // adjacent-branch copy too (grid-30 × FEET_PER_CELL=5 → 150 ft side, 900).
    it('switches to adjacent mode, showing the room-count slider and grid hint', () => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      expect(screen.getByRole('slider', { name: /Room Count/ })).toBeInTheDocument();
      expect(screen.getByText('150 ft × 150 ft (900 squares)')).toBeInTheDocument();
    });

    it('shows the grid-size hint as feet-per-side and total squares', () => {
      render(<GenerateDungeonModal {...props} />);
      expect(screen.getByText('150 ft × 150 ft (900 squares)')).toBeInTheDocument();
      changeField(/Grid Size/, '20');
      expect(screen.getByText('100 ft × 100 ft (400 squares)')).toBeInTheDocument();
    });

    it('enables Generate only when map name has content', () => {
      render(<GenerateDungeonModal {...props} />);
      expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
      fillMapName('My Dungeon');
      expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
    });

    it('disables both buttons during generation', async () => {
      const pending = deferred();
      mapsServiceMocks.createMap.mockImplementationOnce(() => pending.promise);
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Test');
      clickGenerate();

      expect(await screen.findByRole('button', { name: 'Generating...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      pending.resolve({});
      await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    });
  });

  // F11 family law (Item 7 2026-11-25): close answers Cancel, Escape, and a
  // PURE backdrop click like every other overlay (useModalDismiss). Lane
  // mechanics (body-rescue, once-only firing) are pinned in the hook's own
  // tests; these pins prove THIS modal wires the handlers and feeds
  // `disabled: generating` into them.
  describe('dismissal wiring (useModalDismiss lane)', () => {
    it('closes via Cancel and via a pure backdrop click, not a panel click', () => {
      render(<GenerateDungeonModal {...props} />);
      const overlay = screen.getByText('Generate Dungeon Map').closest('.maps-manager-modal-overlay');

      fireEvent.mouseDown(screen.getByText('Generate Dungeon Map').closest('.maps-manager-modal'));
      fireEvent.click(screen.getByText('Generate Dungeon Map').closest('.maps-manager-modal'));
      expect(props.onClose).not.toHaveBeenCalled();

      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);
      expect(props.onClose).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it('Escape on the overlay closes', () => {
      render(<GenerateDungeonModal {...props} />);
      fireEvent.keyDown(document.querySelector('.maps-manager-modal-overlay'), { key: 'Escape' });
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('Escape is inert while a generation is in flight', async () => {
      const pending = deferred();
      mapsServiceMocks.createMap.mockImplementationOnce(() => pending.promise);
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      clickGenerate();
      await waitFor(() => expect(dungeonMocks.generateDungeon).toHaveBeenCalled());

      fireEvent.keyDown(document.querySelector('.maps-manager-modal-overlay'), { key: 'Escape' });
      expect(props.onClose).not.toHaveBeenCalled();

      pending.resolve({});
      await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe('generation flow', () => {
    it('creates the map with typed name and generated data, then notifies and closes', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Goblin Hideout');
      clickGenerate();

      // BSP defaults: grid 30, density 50% → 0.5, random numeric seed
      await waitFor(() => {
        expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 30, density: 0.5, seed: expect.any(Number) }),
        );
      });
      await waitFor(() => {
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith(
          'test-campaign',
          'Goblin Hideout',
          expect.not.objectContaining({ name: expect.anything() }),
        );
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
      expect(dungeonMocks.generateAdjacentDungeon).not.toHaveBeenCalled();
    });

    // The [7,100] gate (SD backlog 2026-11-12) is shared via gridInput.js and
    // its value-space is pinned there; these cases prove the modal's wiring:
    // out-of-range AND blank (Number('') → 0) block with a persistent inline
    // error, no generator call, no POST, modal stays open — in both modes.
    it.each([
      ['5', 'bsp'],
      ['', 'bsp'],
      ['5', 'adjacent'],
    ])('blocks grid size "%s" in %s mode with an inline error and no map created', async (typed, mode) => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      if (mode === 'adjacent') selectMode('Room Adjacent');
      changeField(/Grid Size/, typed);
      clickGenerate();

      const banner = 'Grid size must be between 7 and 100';
      const error = await screen.findByText(banner);
      expect(error).toHaveClass('maps-manager-error');
      expect(dungeonMocks.generateDungeon).not.toHaveBeenCalled();
      expect(dungeonMocks.generateAdjacentDungeon).not.toHaveBeenCalled();
      expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
      expect(props.onMapCreated).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
      // Persistent and recoverable: banner stays, Generate stays enabled,
      // the field keeps the offending value for fixing.
      expect(screen.getByText(banner)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();
      // The field keeps the offending value for fixing (blank reads as 0).
      expect(screen.getByLabelText(/Grid Size/)).toHaveValue(Number(typed));
    });

    // TE backlog 2026-11-12: editing any of the three fields clears a stale
    // banner so it never lingers beside now-valid inputs mid-form.
    it.each([
      ['map name', () => fillMapName('Renamed')],
      ['grid size', () => changeField(/Grid Size/, '20')],
      ['seed', () => changeField(/Seed/, '7')],
    ])('editing the %s field clears a stale error banner', async (_label, edit) => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      changeField(/Grid Size/, '5');
      clickGenerate();

      const banner = 'Grid size must be between 7 and 100';
      expect(await screen.findByText(banner)).toBeInTheDocument();

      edit();
      expect(screen.queryByText(banner)).not.toBeInTheDocument();
    });

    // In-range values pass through unclamped (criterion 5); boundary values
    // are the highest-risk so each mode is pinned at one boundary. The
    // error→fix→success recovery face is pinned by the seed-gate test below.
    it.each([
      ['7', 'bsp', 'generateDungeon'],
      ['100', 'adjacent', 'generateAdjacentDungeon'],
    ])('passes boundary grid size %s through %s mode unclamped', async (typed, mode, fnName) => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      if (mode === 'adjacent') selectMode('Room Adjacent');
      await submitAndExpect(dungeonMocks[fnName], { gridSize: Number(typed) },
        () => changeField(/Grid Size/, typed));
      expect(screen.queryByText('Grid size must be between 7 and 100')).not.toBeInTheDocument();
    });

    it('passes the density slider value to generateDungeon as a fraction', async () => {
      render(<GenerateDungeonModal {...props} />);
      await submitAndExpect(dungeonMocks.generateDungeon, { density: 0.8 },
        () => setSlider(/Density/, '80'));
    });

    // Seed "0" is falsy but a whole number — it must drive the RNG, not be
    // dropped to random (SD backlog 2026-11-12, criterion 3). Effective
    // random-seed routing into the payload is pinned in the stamping suite.
    it.each([
      ['42', 42],
      ['0', 0],
    ])('passes seed "%s" through to generateDungeon as %i', async (typed, seed) => {
      render(<GenerateDungeonModal {...props} />);
      await submitAndExpect(dungeonMocks.generateDungeon, { seed },
        () => changeField(/Seed/, typed));
    });

    // Criterion 1 (seedInput.js owns the value-space): a non-numeric seed
    // blocks with a persistent inline error — no generator call, no POST,
    // modal stays open — and fixing the seed then generates and closes
    // (the recovery face shared by both gates).
    it.each(['abc', '4.5'])(
      'blocks seed "%s" with an inline error, no map created, and recovers after a fix',
      async (typedSeed) => {
        render(<GenerateDungeonModal {...props} />);
        fillMapName('Dungeon');
        changeField(/Seed/, typedSeed);
        clickGenerate();

        const error = await screen.findByText('Seed must be a whole number');
        expect(error).toHaveClass('maps-manager-error');
        expect(dungeonMocks.generateDungeon).not.toHaveBeenCalled();
        expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
        expect(props.onMapCreated).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        // Persistent: still there, buttons re-enabled, seed preserved for fixing
        expect(screen.getByText('Seed must be a whole number')).toBeInTheDocument();
        expect(screen.getByDisplayValue(typedSeed)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();

        changeField(/Seed/, '7');
        clickGenerate();
        await waitFor(() => {
          expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith(
            expect.objectContaining({ seed: 7 }),
          );
          expect(props.onClose).toHaveBeenCalledTimes(1);
        });
      },
    );
  });

  describe('adjacent mode parameters', () => {
    const submitAdjacent = (expectedOptions, interact) =>
      submitAndExpect(dungeonMocks.generateAdjacentDungeon, expectedOptions, interact);

    it('passes the room-count slider to generateAdjacentDungeon', async () => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      await submitAdjacent({ roomCount: 20 }, () => setSlider(/Room Count/, '20'));
    });

    // Each option button maps its label to a wire value; room size also
    // scales min/max room dims off the grid-30 base (min 4, max 12).
    it.each([
      ['Cramped', { minRoom: 3, maxRoom: 8 }],
      ['Standard', { minRoom: 4, maxRoom: 12, roomCount: 8, corridorLength: 'compact', layoutStyle: 'balanced' }],
      ['Spacious', { minRoom: 5, maxRoom: 15 }],
      ['Compact (rooms adjacent)', { corridorLength: 'compact' }],
      ['Moderate', { corridorLength: 'moderate' }],
      ['Sprawling (long halls)', { corridorLength: 'sprawling' }],
      ['Balanced', { layoutStyle: 'balanced' }],
      ['Linear', { layoutStyle: 'linear' }],
      ['Forking', { layoutStyle: 'forking' }],
      ['Winding', { layoutStyle: 'winding' }],
    ])('clicking "%s" passes %o to generateAdjacentDungeon', async (label, expected) => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      await submitAdjacent(expected, () => fireEvent.click(screen.getByText(label)));
    });

    // Small-grid fix (2026-11-12): room bounds cap to gridSize - 2 (1-cell wall
    // margin per side), so a 7-wide grid never sees the old impossible 4–8-wide
    // spec. Grid-30 pins above stay byte-identical (cap 28 never binds).
    it.each([
      ['Cramped', { minRoom: 3, maxRoom: 5 }],
      ['Standard', { minRoom: 4, maxRoom: 5 }],
      ['Spacious', { minRoom: 5, maxRoom: 5 }],
    ])('at grid 7 "%s" passes capped %o (never 4–8-wide)', async (label, expected) => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      await submitAdjacent({ ...expected, gridSize: 7 }, () => {
        changeField(/Grid Size/, '7');
        fireEvent.click(screen.getByText(label));
      });
    });
  });

  // -------------------------------------------------------------------------
  // generationOpts stamping (UF backlog 2026-11-12): the createMap payload
  // must carry the full EFFECTIVE options so the saved doc alone can
  // re-derive its own dungeon.
  // -------------------------------------------------------------------------
  describe('generationOpts stamping', () => {
    const createPayload = () => mapsServiceMocks.createMap.mock.calls[0][2];

    it('stamps bsp mode with the effective gridSize/density/seed', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Bsp Stamped');
      changeField(/Grid Size/, '20');
      changeField(/Seed/, '42');
      setSlider(/Density/, '80');
      clickGenerate();

      await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
      expect(createPayload().generationOpts).toEqual({
        mode: 'bsp',
        gridSize: 20,
        density: 0.8,
        seed: 42,
      });
      // The generator received the same effective knobs (mode excluded).
      expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith({
        gridSize: 20, density: 0.8, seed: 42,
      });
    });

    it('stamps the actual random seed used when the seed field is blank', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Random Seed');
      clickGenerate();

      await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
      const usedSeed = dungeonMocks.generateDungeon.mock.calls[0][0].seed;
      expect(typeof usedSeed).toBe('number');
      expect(Number.isInteger(usedSeed)).toBe(true);
      // The stamped seed is THE seed handed to the generator, not a re-draw.
      expect(createPayload().generationOpts.seed).toBe(usedSeed);
    });

    it('stamps adjacent mode with every effective option incl. roomSize label and derived spans', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Adjacent Stamped');
      selectMode('Room Adjacent');
      changeField(/Grid Size/, '20');
      changeField(/Seed/, '42');
      setSlider(/Room Count/, '10');
      fireEvent.click(screen.getByText('Spacious'));
      fireEvent.click(screen.getByText('Sprawling (long halls)'));
      fireEvent.click(screen.getByText('Winding'));
      clickGenerate();

      await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
      // Grid-20 spacious math: base [4,8] × 1.3 → minRoom 5, maxRoom 10.
      // Adjacent mode has no density knob (the slider is BSP-only and the
      // generator's density fallback is unreachable while roomCount rides the
      // call), so the stamp carries none — a ghost "Density" line in the
      // regenerate copy was the 2026-11-24 QD bug.
      expect(createPayload().generationOpts).toEqual({
        mode: 'adjacent',
        roomSize: 'spacious',
        gridSize: 20,
        seed: 42,
        roomCount: 10,
        corridorLength: 'sprawling',
        layoutStyle: 'winding',
        minRoom: 5,
        maxRoom: 10,
      });
      // The generator got the same derived opts WITHOUT the label-only extras
      // and without a foreign density.
      expect(dungeonMocks.generateAdjacentDungeon).toHaveBeenCalledWith(
        expect.not.objectContaining({ mode: expect.anything(), roomSize: expect.anything(), density: expect.anything() }),
      );
      expect(dungeonMocks.generateAdjacentDungeon).toHaveBeenCalledWith(
        expect.objectContaining({ minRoom: 5, maxRoom: 10, roomCount: 10 }),
      );
    });
  });

  describe('error handling', () => {
    it.each([
      ['generation error', () => dungeonMocks.generateDungeon.mockImplementationOnce(() => { throw new Error('First fail'); }), 'First fail'],
      ['save failure', () => mapsServiceMocks.createMap.mockRejectedValueOnce(new Error('Network error')), 'Network error'],
    ])('shows %s, re-enables buttons, and recovers on retry', async (_label, failOnce, message) => {
      failOnce();
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Retry');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText(message)).toBeInTheDocument();
        expect(props.onMapCreated).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
      });
      expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();

      clickGenerate();
      await waitFor(() => {
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('uses default error message when error has no message', async () => {
      dungeonMocks.generateDungeon.mockImplementationOnce(() => { throw new Error(); });
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Test');
      clickGenerate();

      expect(await screen.findByText('Failed to generate dungeon')).toBeInTheDocument();
    });
  });
});
