// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateDungeonModal from './GenerateDungeonModal';

const { dungeonMocks, dungeonResult } = vi.hoisted(() => {
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
    it('renders modal with title and form fields', () => {
      render(<GenerateDungeonModal {...props} />);
      expect(screen.getByText('Generate Dungeon Map')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. Goblin Hideout')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Random if empty')).toBeInTheDocument();
    });

    // Copy pin (SD backlog 2026-11-12): the note reads "fleshed out", never "flushed".
    it('renders the starting-point note with "fleshed out" copy', () => {
      render(<GenerateDungeonModal {...props} />);
      expect(screen.getByText(
        'Note: This is meant to be just a starting point for you to finish into a fully fleshed out map',
      )).toBeInTheDocument();
      expect(screen.queryByText(/flushed/)).not.toBeInTheDocument();
    });

    it('pre-fills map name from initialMapName prop', () => {
      render(<GenerateDungeonModal {...props} initialMapName="Pre-filled Name" />);
      expect(screen.getByDisplayValue('Pre-filled Name')).toBeInTheDocument();
    });

    it('switches to adjacent mode and shows room count slider', () => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      expect(screen.getByRole('slider', { name: /Room Count/ })).toBeInTheDocument();
    });

    // Grid hint must describe the real map: gridSize cells-per-side at
    // FEET_PER_CELL (5 ft) per cell → N·5 ft square, N² total cells.
    it('shows the grid-size hint as feet-per-side and total squares', () => {
      render(<GenerateDungeonModal {...props} />);
      expect(screen.getByText('150 ft × 150 ft (900 squares)')).toBeInTheDocument();
      changeField(/Grid Size/, '20');
      expect(screen.getByText('100 ft × 100 ft (400 squares)')).toBeInTheDocument();
    });

    it('shows the corrected grid-size hint in Room Adjacent mode too', () => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      expect(screen.getByText('150 ft × 150 ft (900 squares)')).toBeInTheDocument();
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

  describe('closing', () => {
    it('closes via Cancel but not via overlay click', () => {
      render(<GenerateDungeonModal {...props} />);
      const overlay = screen.getByText('Generate Dungeon Map').closest('.maps-manager-modal-overlay');
      fireEvent.click(overlay);
      expect(props.onClose).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(props.onClose).toHaveBeenCalledTimes(1);
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

    // Criteria 1/2/4: an out-of-range (or blanked, which reads as 0) grid size
    // blocks generation with a persistent inline error aligned to the real
    // [7,100] gate — no generator call, no createMap POST, modal stays open
    // (SD backlog 2026-11-12; the old silent clamp is retired).
    it.each(['5', '150', '3', '200', ''])(
      'blocks grid size "%s" with an inline error and no map created',
      async (typed) => {
        render(<GenerateDungeonModal {...props} />);
        fillMapName('Dungeon');
        changeField(/Grid Size/, typed);
        clickGenerate();

        const error = await screen.findByText('Grid size must be between 7 and 100');
        expect(error).toHaveClass('maps-manager-error');
        expect(dungeonMocks.generateDungeon).not.toHaveBeenCalled();
        expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
        expect(props.onMapCreated).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
        // Persistent: still there after the beat, Generate re-enabled, field
        // preserved for fixing
        expect(screen.getByText('Grid size must be between 7 and 100')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();
      },
    );

    it.each(['5', '150'])(
      'blocks grid size "%s" in Room Adjacent mode too (shared field/gate)',
      async (typed) => {
        render(<GenerateDungeonModal {...props} />);
        fillMapName('Dungeon');
        selectMode('Room Adjacent');
        changeField(/Grid Size/, typed);
        clickGenerate();

        expect(await screen.findByText('Grid size must be between 7 and 100')).toBeInTheDocument();
        expect(dungeonMocks.generateAdjacentDungeon).not.toHaveBeenCalled();
        expect(mapsServiceMocks.createMap).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
      },
    );

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

    // Criterion 3: correcting the field dismisses the error path and generates.
    it('recovers after correcting an out-of-range grid size', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      changeField(/Grid Size/, '5');
      clickGenerate();
      expect(await screen.findByText('Grid size must be between 7 and 100')).toBeInTheDocument();

      changeField(/Grid Size/, '20');
      clickGenerate();
      await waitFor(() => {
        expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 20 }),
        );
        expect(mapsServiceMocks.createMap).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
      // The corrected value no longer blocks (same recovery face as the seed
      // gate: the successful generate closes the modal).
      expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();
    });

    // Criterion 5: in-range values pass through unclamped — boundaries 7/100,
    // default 30 (pinned in the flow test above), in BOTH modes.
    it.each([
      ['bsp', '7'],
      ['bsp', '100'],
      ['adjacent', '7'],
      ['adjacent', '100'],
    ])('passes boundary grid size %s through %s mode unclamped', async (mode, typed) => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      if (mode === 'adjacent') selectMode('Room Adjacent');
      const generatorMock = mode === 'adjacent'
        ? dungeonMocks.generateAdjacentDungeon
        : dungeonMocks.generateDungeon;
      await submitAndExpect(generatorMock, { gridSize: Number(typed) },
        () => changeField(/Grid Size/, typed));
      expect(screen.queryByText('Grid size must be between 7 and 100')).not.toBeInTheDocument();
    });

    it.each([
      ['10', 0.1],
      ['80', 0.8],
      ['100', 1.0],
    ])('passes density %s%% as %s to generateDungeon', async (typed, density) => {
      render(<GenerateDungeonModal {...props} />);
      await submitAndExpect(dungeonMocks.generateDungeon, { density },
        () => fireEvent.change(screen.getByRole('slider', { name: /Density/ }), { target: { value: typed } }));
    });

    it('passes a valid numeric seed through to generateDungeon', async () => {
      render(<GenerateDungeonModal {...props} />);
      await submitAndExpect(dungeonMocks.generateDungeon, { seed: 42 },
        () => changeField(/Seed/, '42'));
    });

    // Seed "0" is falsy but a whole number — it must drive the RNG, not be
    // dropped to random (SD backlog 2026-11-12, criterion 3).
    it('honours seed "0" (falsy but valid)', async () => {
      render(<GenerateDungeonModal {...props} />);
      await submitAndExpect(dungeonMocks.generateDungeon, { seed: 0 },
        () => changeField(/Seed/, '0'));
    });

    // Criterion 4: the generator's effective seed is routed into the created
    // map document (result minus name is the createMap payload).
    it('routes the generated seed into the createMap payload', async () => {
      dungeonMocks.generateDungeon.mockImplementationOnce((opts) => ({
        ...dungeonResult,
        seed: opts.seed,
      }));
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Seeded');
      changeField(/Seed/, '42');
      clickGenerate();
      await waitFor(() => {
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith(
          'test-campaign',
          'Seeded',
          expect.objectContaining({ seed: 42 }),
        );
      });
    });

    // Criteria 1: a non-numeric seed blocks generation with a persistent
    // inline error — no generator call, no createMap POST, modal stays open,
    // and fixing the seed succeeds.
    it.each(['abc', '4.5', '12abc'])(
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

    it.each([
      ['3', 'min'],
      ['20', 'max'],
    ])('passes %s room count (%s) to generateAdjacentDungeon', async (typed) => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      await submitAdjacent({ roomCount: Number(typed) },
        () => fireEvent.change(screen.getByRole('slider', { name: /Room Count/ }), { target: { value: typed } }));
    });

    // Room size scales min/max room dims off the grid-30 base (min 4, max 12)
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
