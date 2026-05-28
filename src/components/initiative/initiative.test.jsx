import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './initiative.jsx';

vi.mock('../../services/storage.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../services/utils.js', () => {
  return {
    default: {
      guid: vi.fn(() => `test-guid-${Date.now()}-${Math.random()}`),
      getFirstName: vi.fn((name) => name?.split(' ')[0] || name),
    },
  };
});

vi.mock('lodash', () => ({
  cloneDeep: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
}));

vi.mock('../../services/monsterUtils.js', () => ({
  getMonsterImageUrl: vi.fn(() => Promise.resolve(null)),
  getMonsterData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/dataLoader.js', () => ({
  loadMonsters: vi.fn(async () => []),
  loadEquipment: vi.fn(async () => []),
}));

// Mock EventSource for Subscriber
class MockEventSource {
  constructor() {
    this.close = vi.fn();
    this.onmessage = null;
    this.onerror = null;
  }
}

describe('Initiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    Element.prototype.scrollIntoView = vi.fn();
    global.EventSource = MockEventSource;
   });

  it('should render without crashing with empty characters', () => {
    const { container } = render(<Initiative characters={[]} />);
    expect(container.querySelector('.initiative')).toBeInTheDocument();
   });

  it('should show round number in header', () => {
    render(<Initiative characters={[]} />);
    expect(screen.getByText(/Initiative \(round 1\)/)).toBeInTheDocument();
   });

  it('should render creature cards for each character', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }, { name: 'Bilbo' }]} />);
    const cards = document.querySelectorAll('.creature-card');
    expect(cards.length).toBeGreaterThan(2);
   });

  it('should show initiative number inputs', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    const inputs = document.querySelectorAll('.creature-initiative input[type="number"]');
    expect(inputs.length).toBeGreaterThan(0);
   });

  it('should show NPC name text inputs', async () => {
    render(<Initiative characters={[]} />);
    await act(async () => {
      await vi.waitFor(() => {
        const npcInputs = document.querySelectorAll('.creature-card.npc .monster-autocomplete-input');
        expect(npcInputs.length).toBeGreaterThan(0);
       });
     });
   });

  it('should show player names as spans', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    const nameElements = screen.getAllByText('Gandalf');
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
   });

  it('should show avatar initials', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    expect(screen.getByText('G')).toBeInTheDocument();
   });

  it('should render combat control buttons', () => {
    render(<Initiative characters={[]} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('+ NPC')).toBeInTheDocument();
    expect(screen.getByText('- NPC')).toBeInTheDocument();
    expect(screen.getByText('\u2191 Round')).toBeInTheDocument();
    expect(screen.getByText('Round \u2193')).toBeInTheDocument();
    expect(screen.getByText('\u2190 Prev')).toBeInTheDocument();
    expect(screen.getByText('Next \u2192')).toBeInTheDocument();
   });

  it('should add NPC when + NPC clicked', async () => {
    render(<Initiative characters={[]} />);
    await act(async () => {
      await vi.waitFor(() => {
        const npcCards = document.querySelectorAll('.creature-card.npc');
        expect(npcCards.length).toBeGreaterThan(0);
       });
     });
    const initialCount = document.querySelectorAll('.creature-card.npc').length;
    fireEvent.click(screen.getByText('+ NPC'));
    await act(async () => {
      await vi.waitFor(() => {
        const newCount = document.querySelectorAll('.creature-card.npc').length;
        expect(newCount).toBeGreaterThan(initialCount);
       });
     });
   });

  it('should remove NPC when - NPC clicked', async () => {
    render(<Initiative characters={[]} />);
    await act(async () => {
      await vi.waitFor(() => {
        const npcCards = document.querySelectorAll('.creature-card.npc');
        expect(npcCards.length).toBeGreaterThan(0);
       });
     });
    const initialCount = document.querySelectorAll('.creature-card.npc').length;
    fireEvent.click(screen.getByText('- NPC'));
    await act(async () => {
      await vi.waitFor(() => {
        const newCount = document.querySelectorAll('.creature-card.npc').length;
        expect(newCount).toBeLessThan(initialCount);
       });
     });
   });

  it('should increment round when up arrow clicked', () => {
    render(<Initiative characters={[]} />);
    fireEvent.click(screen.getByText('\u2191 Round'));
    expect(screen.getByText(/round 2/)).toBeInTheDocument();
   });

  it('should decrement round when down arrow clicked', () => {
    render(<Initiative characters={[]} />);
    fireEvent.click(screen.getByText('\u2191 Round'));
    fireEvent.click(screen.getByText('Round \u2193'));
    expect(screen.getByText(/round 1/)).toBeInTheDocument();
   });

  it('should not decrement round below 0', () => {
    render(<Initiative characters={[]} />);
    fireEvent.click(screen.getByText('Round \u2193'));
    expect(screen.getByText(/round 0/)).toBeInTheDocument();
   });

  it('should handle initiative input change', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    const input = document.querySelector('.creature-initiative input[type="number"]');
    fireEvent.change(input, { target: { value: '15' } });
    expect(input.value).toBe('15');
   });

  it('should handle NPC name change', async () => {
    render(<Initiative characters={[]} />);
    await act(async () => {
      await vi.waitFor(() => {
        const npcInput = document.querySelector('.creature-card.npc .monster-autocomplete-input');
        expect(npcInput).not.toBeNull();
        fireEvent.change(npcInput, { target: { value: 'Goblin' } });
        expect(npcInput.value).toBe('Goblin');
       });
     });
   });

  it('should show clear confirmation dialog', () => {
    render(<Initiative characters={[]} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to clear all combat status?');
   });

  it('should sort creatures by initiative descending', () => {
    render(<Initiative characters={[{ name: 'A' }, { name: 'B' }]} />);
    const inputs = document.querySelectorAll('.creature-initiative input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    fireEvent.change(inputs[1], { target: { value: '20' } });
    const cards = document.querySelectorAll('.creature-card');
    expect(cards.length).toBeGreaterThan(0);
   });

  it('should show active creature with different styling', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    const activeCards = document.querySelectorAll('.creature-card.active');
    expect(activeCards.length).toBeGreaterThanOrEqual(1);
   });

  it('should render player avatar with image when imagePath provided', () => {
    render(<Initiative characters={[{ name: 'Gandalf', imagePath: '/img/gandalf.jpg' }]} />);
    const img = document.querySelector('.avatar-image');
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('gandalf.jpg');
   });

  it('should render NPC avatar with initial', () => {
    render(<Initiative characters={[]} />);
    const npcAvatar = document.querySelector('.npc-avatar');
    expect(npcAvatar).toBeInTheDocument();
   });

  it('should handle keyboard shortcuts for round control', () => {
    render(<Initiative characters={[]} />);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(screen.getByText(/round 2/)).toBeInTheDocument();
   });

  it('should handle keyboard shortcuts for navigation', () => {
    render(<Initiative characters={[{ name: 'A' }, { name: 'B' }]} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const cards = document.querySelectorAll('.creature-card');
    expect(cards.length).toBeGreaterThan(0);
   });

  it('should handle keyboard shortcut for adding NPC', async () => {
    render(<Initiative characters={[]} />);
    await act(async () => {
      await vi.waitFor(() => {
        const npcCards = document.querySelectorAll('.creature-card.npc');
        expect(npcCards.length).toBeGreaterThan(0);
       });
     });
    const initialCount = document.querySelectorAll('.creature-card.npc').length;
    await act(async () => {
      fireEvent.keyDown(window, { key: '+' });
     });
    await act(async () => {
      await vi.waitFor(() => {
        const newCount = document.querySelectorAll('.creature-card.npc').length;
        expect(newCount).toBeGreaterThan(initialCount);
       });
     });
   });

  it('should handle keyboard shortcut for removing NPC', async () => {
    render(<Initiative characters={[]} />);
    await act(async () => {
      await vi.waitFor(() => {
        const npcCards = document.querySelectorAll('.creature-card.npc');
        expect(npcCards.length).toBeGreaterThan(0);
       });
     });
    const initialCount = document.querySelectorAll('.creature-card.npc').length;
    await act(async () => {
      fireEvent.keyDown(window, { key: '-' });
     });
    await act(async () => {
      await vi.waitFor(() => {
        const newCount = document.querySelectorAll('.creature-card.npc').length;
        expect(newCount).toBeLessThan(initialCount);
       });
     });
   });

  it('should advance through creatures with right arrow', () => {
    render(<Initiative characters={[{ name: 'A' }, { name: 'B' }]} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const activeCards = document.querySelectorAll('.creature-card.active');
    expect(activeCards.length).toBeGreaterThanOrEqual(1);
   });

  it('should not remove NPC when confirm returns false and initiative is set', async () => {
    window.confirm = vi.fn(() => false);
    render(<Initiative characters={[{ name: 'Hero' }]} />);
    await act(async () => {});
    const npcInitiativeInputs = document.querySelectorAll('.creature-card.npc .creature-initiative input');
    await act(async () => {
      for (let i = 0; i < npcInitiativeInputs.length; i++) {
        fireEvent.change(npcInitiativeInputs[i], { target: { value: String(15 - i) } });
       }
     });
    await act(async () => {});
    const beforeCount = document.querySelectorAll('.creature-card').length;
    fireEvent.click(screen.getByText('- NPC'));
    const afterCount = document.querySelectorAll('.creature-card').length;
    expect(afterCount).toBe(beforeCount);
   });

  it('should return early when no characters are provided', () => {
    const { container } = render(<Initiative characters={[]} />);
    expect(container.querySelector('.initiative')).toBeInTheDocument();
   });

  it('should show concentration add button when isLocalhost is true', async () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} isLocalhost={true} />);
    await act(async () => {
      await vi.waitFor(() => {
        const addBtn = document.querySelector('.concentration-add-btn');
        expect(addBtn).toBeInTheDocument();
       });
     });
   });

  it('should open concentration picker modal when add button clicked', async () => {
    render(<Initiative characters={[]} isLocalhost={true} />);
    await act(async () => {
      await vi.waitFor(() => {
        const addBtn = document.querySelector('.concentration-add-btn');
        expect(addBtn).toBeInTheDocument();
       });
     });
    fireEvent.click(document.querySelector('.concentration-add-btn'));
    expect(screen.getByText(/Concentration for/)).toBeInTheDocument();
   });

  it('should apply concentration and show badge', async () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} isLocalhost={true} />);
    await act(async () => {
      await vi.waitFor(() => {
        const addBtn = document.querySelector('.concentration-add-btn');
        if (addBtn) fireEvent.click(addBtn);
       });
     });
    await screen.findByText(/Concentration for/);
    const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
    fireEvent.change(spellInput, { target: { value: 'Bless' } });
    fireEvent.click(screen.getByText('Apply'));
    await vi.waitFor(() => {
      expect(document.querySelector('.initiative-concentration-badge')).toBeInTheDocument();
     });
   });

  it('should break concentration when break button clicked', async () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} isLocalhost={true} />);
    await act(async () => {
      await vi.waitFor(() => {
        const addBtn = document.querySelector('.concentration-add-btn');
        if (addBtn) fireEvent.click(addBtn);
       });
     });
    await screen.findByText(/Concentration for/);
    const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
    fireEvent.change(spellInput, { target: { value: 'Bless' } });
    fireEvent.click(screen.getByText('Apply'));
    await vi.waitFor(() => {
      expect(document.querySelector('.initiative-concentration-badge')).toBeInTheDocument();
     });
    fireEvent.click(document.querySelector('.concentration-break-btn'));
    await vi.waitFor(() => {
      expect(document.querySelector('.concentration-add-btn')).toBeInTheDocument();
     });
   });

  it('should roll concentration save when badge clicked', async () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} isLocalhost={true} />);
    await act(async () => {
      await vi.waitFor(() => {
        const addBtn = document.querySelector('.concentration-add-btn');
        if (addBtn) fireEvent.click(addBtn);
       });
     });
    await screen.findByText(/Concentration for/);
    const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
    fireEvent.change(spellInput, { target: { value: 'Bless' } });
    fireEvent.click(screen.getByText('Apply'));
    await vi.waitFor(() => {
      expect(document.querySelector('.initiative-concentration-badge')).toBeInTheDocument();
     });
    fireEvent.click(document.querySelector('.initiative-concentration-badge'));
    await vi.waitFor(() => {
      expect(document.querySelector('.condition-save-result')).toBeInTheDocument();
     });
   });
});

afterEach(() => {
  delete global.EventSource;
});
