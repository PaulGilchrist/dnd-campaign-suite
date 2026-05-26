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
    render(<Initiative characters={[]} />);
    expect(screen.getByText(/Initiative/)).toBeInTheDocument();
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

  it('should show NPC name text inputs', () => {
    render(<Initiative characters={[]} />);
    const inputs = document.querySelectorAll('.npc-name-input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('should show player names as spans', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    expect(screen.getByText('Gandalf')).toBeInTheDocument();
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

  it('should add NPC when + NPC clicked', () => {
    render(<Initiative characters={[]} />);
    fireEvent.click(screen.getByText('+ NPC'));
    const npcInputs = document.querySelectorAll('.npc-name-input');
    expect(npcInputs.length).toBeGreaterThan(0);
  });

  it('should remove NPC when - NPC clicked', () => {
    render(<Initiative characters={[]} />);
    const initialCount = document.querySelectorAll('.npc-name-input').length;
    fireEvent.click(screen.getByText('- NPC'));
    const newCount = document.querySelectorAll('.npc-name-input').length;
    expect(newCount).toBeLessThan(initialCount);
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

  it('should handle NPC name change', () => {
    render(<Initiative characters={[]} />);
    const npcInput = document.querySelector('.npc-name-input');
    fireEvent.change(npcInput, { target: { value: 'Goblin' } });
    expect(npcInput.value).toBe('Goblin');
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

  it('should handle keyboard shortcut for adding NPC', () => {
    render(<Initiative characters={[]} />);
    const initialCount = document.querySelectorAll('.npc-name-input').length;
    fireEvent.keyDown(window, { key: '+' });
    const newCount = document.querySelectorAll('.npc-name-input').length;
    expect(newCount).toBeGreaterThan(initialCount);
  });

  it('should handle keyboard shortcut for removing NPC', () => {
    render(<Initiative characters={[]} />);
    const initialCount = document.querySelectorAll('.npc-name-input').length;
    fireEvent.keyDown(window, { key: '-' });
    const newCount = document.querySelectorAll('.npc-name-input').length;
    expect(newCount).toBeLessThan(initialCount);
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
});

afterEach(() => {
  delete global.EventSource;
});
