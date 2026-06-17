import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ItemsPanel from './ItemsPanel';

// Mock all SVG imports
vi.mock('./AltarSVG.jsx', () => ({ default: () => 'AltarSVG' }));
vi.mock('./ArrowSlitWallSVG.jsx', () => ({ default: () => 'ArrowSlitWallSVG' }));
vi.mock('./BarrelSVG.jsx', () => ({ default: () => 'BarrelSVG' }));
vi.mock('./BedSVG.jsx', () => ({ default: () => 'BedSVG' }));
vi.mock('./BookshelfSVG.jsx', () => ({ default: () => 'BookshelfSVG' }));
vi.mock('./BoulderSVG.jsx', () => ({ default: () => 'BoulderSVG' }));
vi.mock('./BushSVG.jsx', () => ({ default: () => 'BushSVG' }));
vi.mock('./ChairSVG.jsx', () => ({ default: () => 'ChairSVG' }));
vi.mock('./ChestSVG.jsx', () => ({ default: () => 'ChestSVG' }));
vi.mock('./CrateSVG.jsx', () => ({ default: () => 'CrateSVG' }));
vi.mock('./DoorSVG.jsx', () => ({ default: () => 'DoorSVG' }));
vi.mock('./FirePitSVG.jsx', () => ({ default: () => 'FirePitSVG' }));
vi.mock('./FountainSVG.jsx', () => ({ default: () => 'FountainSVG' }));
vi.mock('./PillarSVG.jsx', () => ({ default: () => 'PillarSVG' }));
vi.mock('./SecretDoorSVG.jsx', () => ({ default: () => 'SecretDoorSVG' }));
vi.mock('./StairsSVG.jsx', () => ({ default: () => 'StairsSVG' }));
vi.mock('./StatueSVG.jsx', () => ({ default: () => 'StatueSVG' }));
vi.mock('./TableSVG.jsx', () => ({ default: () => 'TableSVG' }));
vi.mock('./TorchSVG.jsx', () => ({ default: () => 'TorchSVG' }));
vi.mock('./TrapSVG.jsx', () => ({ default: () => 'TrapSVG' }));
vi.mock('./TreeSVG.jsx', () => ({ default: () => 'TreeSVG' }));
vi.mock('./WebSVG.jsx', () => ({ default: () => 'WebSVG' }));

const defaultProps = {
  itemsPanelOpen: true,
  onClose: vi.fn(),
  characters: [],
  players: [],
  mapVariant: 'indoor',
};

describe('ItemsPanel', () => {
  it('returns null when itemsPanelOpen is false', () => {
    const { container } = render(<ItemsPanel {...defaultProps} itemsPanelOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders close button when open', () => {
    render(<ItemsPanel {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(<ItemsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders indoor items by default', () => {
    render(<ItemsPanel {...defaultProps} />);
    expect(screen.getByText('Altar')).toBeInTheDocument();
    expect(screen.getByText('Door')).toBeInTheDocument();
    expect(screen.getByText('Treasure Chest')).toBeInTheDocument();
  });

  it('renders outdoor items when mapVariant is outdoor', () => {
    render(<ItemsPanel {...defaultProps} mapVariant="outdoor" />);
    expect(screen.getByText('Barrel')).toBeInTheDocument();
    expect(screen.getByText('Tree')).toBeInTheDocument();
    expect(screen.queryByText('Altar')).not.toBeInTheDocument();
  });

  it('renders NPC item', () => {
    render(<ItemsPanel {...defaultProps} />);
    expect(screen.getByText('NPC')).toBeInTheDocument();
  });

  it('renders characters section when characters are not in players', () => {
    render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }]} players={[{ name: 'Player1' }]} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });

  it('does not render characters section when all characters are players', () => {
    render(<ItemsPanel {...defaultProps} characters={[{ name: 'Player1' }]} players={[{ name: 'Player1' }]} />);
    expect(screen.queryByText('Characters')).not.toBeInTheDocument();
  });

  it('does not render characters section when no characters', () => {
    render(<ItemsPanel {...defaultProps} characters={[]} players={[]} />);
    expect(screen.queryByText('Characters')).not.toBeInTheDocument();
  });

  it('renders character initial when no imagePath', () => {
    render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }]} players={[]} />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('renders character image when imagePath provided', () => {
    render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin', imagePath: '/goblin.png' }]} players={[]} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/goblin.png');
  });

  it('renders multiple missing characters', () => {
    render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }, { name: 'Orc' }]} players={[{ name: 'Player1' }]} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
  });

  it('renders with empty players and characters arrays', () => {
    render(<ItemsPanel {...defaultProps} characters={[]} players={[]} />);
    expect(screen.getByText('Altar')).toBeInTheDocument();
  });

  it('renders indoor items with correct labels', () => {
    render(<ItemsPanel {...defaultProps} />);
    const labels = ['Altar', 'Arrow Slit Wall', 'Barrel', 'Bed', 'Bookshelf', 'Chair', 'Treasure Chest', 'Crate', 'Door', 'Fire Pit', 'Fountain', 'Pillar', 'Secret Door', 'Stairs', 'Statue', 'Table', 'Torch', 'Trap', 'Spider Web', 'NPC'];
    labels.forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('drag and drop', () => {
    const getGhostDivs = () =>
      Array.from(document.body.children).filter(
        c => c.tagName === 'DIV' && c.style.top === '-9999px'
      );

    const ghostCleanup = () => {
      getGhostDivs().forEach(c => c.remove());
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
      ghostCleanup();
    });

    const fireDragStart = (labelText) => {
      const mockDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const el = screen.getByText(labelText).closest('.items-panel-item');
      fireEvent.dragStart(el, { dataTransfer: mockDT });
      return mockDT;
    };

    it('sets drag data type for indoor item', () => {
      render(<ItemsPanel {...defaultProps} />);
      const mockDT = fireDragStart('Barrel');
      expect(mockDT.setData).toHaveBeenCalledWith('text/plain', 'barrel');
    });

    it('sets drag data type for outdoor item', () => {
      render(<ItemsPanel {...defaultProps} mapVariant="outdoor" />);
      const mockDT = fireDragStart('Tree');
      expect(mockDT.setData).toHaveBeenCalledWith('text/plain', 'tree');
    });

    it('sets drag data type for NPC', () => {
      render(<ItemsPanel {...defaultProps} />);
      const mockDT = fireDragStart('NPC');
      expect(mockDT.setData).toHaveBeenCalledWith('text/plain', 'npc');
    });

    it('sets drag data type for character', () => {
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }]} players={[]} />);
      const mockDT = fireDragStart('Goblin');
      expect(mockDT.setData).toHaveBeenCalledWith('text/plain', 'character:Goblin');
    });

    it('calls setDragImage for item drag', () => {
      render(<ItemsPanel {...defaultProps} />);
      const mockDT = fireDragStart('Barrel');
      expect(mockDT.setDragImage).toHaveBeenCalled();
    });

    it('calls setDragImage for NPC drag', () => {
      render(<ItemsPanel {...defaultProps} />);
      const mockDT = fireDragStart('NPC');
      expect(mockDT.setDragImage).toHaveBeenCalled();
    });

    it('calls setDragImage for character drag', () => {
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }]} players={[]} />);
      const mockDT = fireDragStart('Goblin');
      expect(mockDT.setDragImage).toHaveBeenCalled();
    });

    it('creates ghost div in DOM for item drag', () => {
      render(<ItemsPanel {...defaultProps} />);
      const mockDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const barrel = screen.getByText('Barrel').closest('.items-panel-item');
      fireEvent.dragStart(barrel, { dataTransfer: mockDT });

      const ghosts = getGhostDivs();
      expect(ghosts).toHaveLength(1);
      expect(ghosts[0].querySelector('svg')).toBeInTheDocument();
    });

    it('creates ghost div in DOM for NPC drag', () => {
      render(<ItemsPanel {...defaultProps} />);
      const mockDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const npc = screen.getByText('NPC').closest('.items-panel-item');
      fireEvent.dragStart(npc, { dataTransfer: mockDT });

      const ghosts = getGhostDivs();
      expect(ghosts).toHaveLength(1);
      expect(ghosts[0].querySelector('svg')).toBeInTheDocument();
    });

    it('creates character ghost with initial letter', () => {
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }]} players={[]} />);
      const mockDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const char = screen.getByText('Goblin').closest('.items-panel-item');
      fireEvent.dragStart(char, { dataTransfer: mockDT });

      const ghosts = getGhostDivs();
      expect(ghosts).toHaveLength(1);
      const svg = ghosts[0].querySelector('svg');
      expect(svg).toBeInTheDocument();
      const text = svg.querySelector('text');
      expect(text).toBeInTheDocument();
      expect(text.textContent).toBe('G');
    });

    it('removes ghost div from DOM after timeout', () => {
      render(<ItemsPanel {...defaultProps} />);
      const mockDT = { setData: vi.fn(), setDragImage: vi.fn() };
      const barrel = screen.getByText('Barrel').closest('.items-panel-item');
      fireEvent.dragStart(barrel, { dataTransfer: mockDT });

      expect(getGhostDivs()).toHaveLength(1);

      vi.advanceTimersByTime(0);

      expect(getGhostDivs()).toHaveLength(0);
    });

    it('shows characters section title when characters are missing from players', () => {
      render(<ItemsPanel {...defaultProps} characters={[{ name: 'Goblin' }]} players={[]} />);
      expect(screen.getByText('Characters')).toBeInTheDocument();
    });
  });
});
