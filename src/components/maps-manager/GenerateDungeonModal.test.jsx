// @maintained-by-ai: 2026-10-14
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

    it('pre-fills map name from initialMapName prop', () => {
      render(<GenerateDungeonModal {...props} initialMapName="Pre-filled Name" />);
      expect(screen.getByDisplayValue('Pre-filled Name')).toBeInTheDocument();
    });

    it('switches to adjacent mode and shows room count slider', () => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      expect(screen.getByRole('slider', { name: /Room Count/ })).toBeInTheDocument();
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

    it.each([
      ['3', 7],
      ['200', 100],
      ['50', 50],
    ])('clamps grid size input %s to %s', async (typed, clamped) => {
      render(<GenerateDungeonModal {...props} />);
      await submitAndExpect(dungeonMocks.generateDungeon, { gridSize: clamped },
        () => changeField(/Grid Size/, typed));
      if (typed !== '50') {
        expect(screen.getByText(new RegExp(`Using ${clamped}`))).toBeInTheDocument();
      }
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

    it.each([
      ['42', 42],
      ['abc', NaN],
    ])('passes seed input "%s" through parseInt', async (typedSeed, expectedSeed) => {
      render(<GenerateDungeonModal {...props} />);
      await submitAndExpect(dungeonMocks.generateDungeon, { seed: expectedSeed },
        () => changeField(/Seed/, typedSeed));
    });
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
