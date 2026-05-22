import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Initiative from './initiative.jsx';

vi.mock('../../services/storage.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../services/utils.js', () => ({
  default: {
    guid: vi.fn(() => 'test-guid'),
    getFirstName: vi.fn((name) => name?.split(' ')[0] || name),
  },
}));

vi.mock('lodash', () => ({
  cloneDeep: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
}));

describe('Initiative', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  it('renders without crashing with empty characters', () => {
    render(<Initiative characters={[]} />);
    expect(screen.getByText(/Initiative/)).toBeInTheDocument();
  });

  it('shows round number in header', () => {
    render(<Initiative characters={[]} />);
    expect(screen.getByText(/Initiative \(round 1\)/)).toBeInTheDocument();
  });

  it('renders creature cards for each character', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }, { name: 'Bilbo' }]} />);
    const cards = document.querySelectorAll('.creature-card');
    expect(cards.length).toBeGreaterThan(2);
  });

  it('shows initiative number inputs', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    const initiativeInputs = document.querySelectorAll('.creature-initiative input[type="number"]');
    expect(initiativeInputs.length).toBeGreaterThan(0);
  });

  it('shows NPC name text inputs', () => {
    render(<Initiative characters={[]} />);
    const npcNameInputs = document.querySelectorAll('.npc-name-input');
    expect(npcNameInputs.length).toBeGreaterThan(0);
  });

  it('shows player names as spans', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    expect(screen.getByText('Gandalf')).toBeInTheDocument();
  });

  it('shows avatar initials', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('does NOT render notes inputs', () => {
    render(<Initiative characters={[{ name: 'Gandalf' }]} />);
    const cards = document.querySelectorAll('.creature-card');
    for (const card of cards) {
      const inputs = card.querySelectorAll('input');
      for (const input of inputs) {
        expect(input.type).not.toBe('notes');
      }
    }
  });

  it('renders combat control buttons', () => {
    render(<Initiative characters={[]} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('+ NPC')).toBeInTheDocument();
    expect(screen.getByText('- NPC')).toBeInTheDocument();
    expect(screen.getByText('↑ Round')).toBeInTheDocument();
    expect(screen.getByText('Round ↓')).toBeInTheDocument();
    expect(screen.getByText('← Prev')).toBeInTheDocument();
    expect(screen.getByText('Next →')).toBeInTheDocument();
  });
});
