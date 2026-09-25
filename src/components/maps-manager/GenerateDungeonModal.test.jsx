// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateDungeonModal from './GenerateDungeonModal';

const { dungeonMocks } = vi.hoisted(() => {
  const defaultDungeonResult = {
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
      generateDungeon: vi.fn(() => ({ ...defaultDungeonResult })),
      generateAdjacentDungeon: vi.fn(() => ({ ...defaultDungeonResult })),
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

const clickCancelButton = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

const selectMode = (modeLabel) =>
  fireEvent.click(screen.getByRole('button', { name: modeLabel }));

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
  let container;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      campaignName: 'test-campaign',
      initialMapName: '',
      onClose: vi.fn(),
      onMapCreated: vi.fn(),
    };
  });

  afterEach(() => {
    if (container) {
      container.remove();
      container = null;
    }
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  describe('rendering', () => {
    it('renders modal with title and form fields', () => {
      ({ container } = render(<GenerateDungeonModal {...props} />));
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
  });

  // -------------------------------------------------------------------------
  // Generate button state
  // -------------------------------------------------------------------------
  describe('generate button state', () => {
    it('is disabled when map name is empty', () => {
      render(<GenerateDungeonModal {...props} />);
      expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    });

    it('is enabled when map name has content', () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('My Dungeon');
      expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
    });

    it('is disabled during generation', async () => {
      const pending = deferred();
      mapsServiceMocks.createMap.mockImplementationOnce(() => pending.promise);
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Test');
      clickGenerate();

      const generatingButton = await screen.findByRole('button', { name: 'Generating...' });
      expect(generatingButton).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      pending.resolve({});
      await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    });
  });

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------
  describe('cancel', () => {
    it('calls onClose when Cancel button is clicked', () => {
      render(<GenerateDungeonModal {...props} />);
      clickCancelButton();
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when the overlay background is clicked', () => {
      render(<GenerateDungeonModal {...props} />);
      const overlay = screen.getByText('Generate Dungeon Map').closest('.maps-manager-modal-overlay');
      fireEvent.click(overlay);
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Generate Dungeon Map')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Generation flow
  // -------------------------------------------------------------------------
  describe('generation flow', () => {
    it('creates the map with typed name and generated data, then notifies and closes', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Goblin Hideout');
      clickGenerate();

      await waitFor(() => {
        expect(mapsServiceMocks.createMap).toHaveBeenCalledWith(
          'test-campaign',
          'Goblin Hideout',
          expect.objectContaining({ gridSize: 30 }),
        );
      });
      await waitFor(() => {
        expect(props.onMapCreated).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
      });
      expect(dungeonMocks.generateAdjacentDungeon).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Grid size clamping
  // -------------------------------------------------------------------------
  describe('grid size clamping', () => {
    it('clamps to minimum when grid size is below 7', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      fireEvent.change(screen.getByLabelText(/Grid Size/), { target: { value: '3' } });
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 7 }),
        );
      });
    });

    it('clamps to maximum when grid size is above 100', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      fireEvent.change(screen.getByLabelText(/Grid Size/), { target: { value: '200' } });
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 100 }),
        );
      });
    });

    it('uses grid size as-is when within valid range', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      fireEvent.change(screen.getByLabelText(/Grid Size/), { target: { value: '50' } });
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ gridSize: 50 }),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Density slider
  // -------------------------------------------------------------------------
  describe('density slider', () => {
    it.each([
      ['default 50%', null, 0.5],
      ['10%', '10', 0.1],
      ['80%', '80', 0.8],
      ['100%', '100', 1.0],
    ])('passes density %s as decimal to generateDungeon', async (_label, typedValue, expectedDensity) => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      if (typedValue !== null) {
        fireEvent.change(screen.getByRole('slider', { name: /Density/ }), { target: { value: typedValue } });
      }
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ density: expectedDensity }),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Adjacent mode parameters
  // -------------------------------------------------------------------------
  describe('adjacent mode parameters', () => {
    it.each([
      ['min room count', 3],
      ['default room count', 8],
      ['max room count', 20],
    ])('passes %s to generateAdjacentDungeon', async (_label, roomCount) => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      fillMapName('Adjacent Dungeon');
      fireEvent.change(screen.getByRole('slider', { name: /Room Count/ }), { target: { value: String(roomCount) } });
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateAdjacentDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ roomCount }),
        );
      });
    });

    it.each([
      ['Cramped', 3, 8],
      ['Standard', 4, 12],
      ['Spacious', 5, 15],
    ])('scales min/max room dimensions for %s room size', async (roomSize, minRoom, maxRoom) => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      fillMapName('Adjacent Dungeon');
      fireEvent.click(screen.getByText(roomSize));
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateAdjacentDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ minRoom, maxRoom }),
        );
      });
    });

    it.each([
      ['Compact (rooms adjacent)', 'compact'],
      ['Moderate', 'moderate'],
      ['Sprawling (long halls)', 'sprawling'],
    ])('passes corridor length "%s" to generateAdjacentDungeon', async (_label, expectedValue) => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      fillMapName('Adjacent Dungeon');
      fireEvent.click(screen.getByText(_label));
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateAdjacentDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ corridorLength: expectedValue }),
        );
      });
    });

    it.each([
      ['Balanced', 'balanced'],
      ['Linear', 'linear'],
      ['Forking', 'forking'],
      ['Winding', 'winding'],
    ])('passes layout style "%s" to generateAdjacentDungeon', async (_label, expectedValue) => {
      render(<GenerateDungeonModal {...props} />);
      selectMode('Room Adjacent');
      fillMapName('Adjacent Dungeon');
      fireEvent.click(screen.getByText(_label));
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateAdjacentDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ layoutStyle: expectedValue }),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Seed handling
  // -------------------------------------------------------------------------
  describe('seed handling', () => {
    it.each([
      ['passes parsed integer seed', '42', 42],
      ['generates random seed when empty', '', expect.any(Number)],
    ])('seed %s', async (_label, typedSeed, expectedSeed) => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      fireEvent.change(screen.getByPlaceholderText('Random if empty'), { target: { value: typedSeed } });
      clickGenerate();

      await waitFor(() => {
        expect(dungeonMocks.generateDungeon).toHaveBeenCalledWith(
          expect.objectContaining({ seed: expectedSeed }),
        );
      });
    });

    it('passes NaN for non-numeric input', async () => {
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Dungeon');
      fireEvent.change(screen.getByPlaceholderText('Random if empty'), { target: { value: 'abc' } });
      clickGenerate();

      await waitFor(() => {
        const callArgs = dungeonMocks.generateDungeon.mock.calls[0][0];
        expect(callArgs.seed).toBeNaN();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('shows error, re-enables buttons, and does not close when generation throws', async () => {
      dungeonMocks.generateDungeon.mockImplementationOnce(() => { throw new Error('Boom'); });
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Test');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('Boom')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
      expect(props.onMapCreated).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('shows error and does not close when createMap fails', async () => {
      mapsServiceMocks.createMap.mockRejectedValueOnce(new Error('Save failed'));
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Test');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();
      expect(props.onMapCreated).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('uses default error message when error has no message', async () => {
      dungeonMocks.generateDungeon.mockImplementationOnce(() => { throw new Error(); });
      render(<GenerateDungeonModal {...props} />);
      fillMapName('Test');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('Failed to generate dungeon')).toBeInTheDocument();
      });
    });

    it('allows a successful retry after a generation error', async () => {
      dungeonMocks.generateDungeon
        .mockImplementationOnce(() => { throw new Error('First fail'); })
        .mockReturnValueOnce({ name: 'Retry Dungeon', gridSize: 30, walls: [], placedItems: [], players: [], zoom: 1, panX: 0, panY: 0 });

      render(<GenerateDungeonModal {...props} />);
      fillMapName('Retry');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('First fail')).toBeInTheDocument();
      });

      clickGenerate();
      await waitFor(() => {
        expect(props.onMapCreated).toHaveBeenCalled();
        expect(props.onClose).toHaveBeenCalled();
      });
    });

    it('allows a successful retry after a createMap failure', async () => {
      mapsServiceMocks.createMap
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({});

      render(<GenerateDungeonModal {...props} />);
      fillMapName('Retry');
      clickGenerate();

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      clickGenerate();
      await waitFor(() => {
        expect(props.onMapCreated).toHaveBeenCalled();
        expect(props.onClose).toHaveBeenCalled();
      });
    });
  });
});
