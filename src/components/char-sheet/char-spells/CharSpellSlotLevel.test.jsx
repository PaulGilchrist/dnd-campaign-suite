import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';

// Mock the storage service
vi.mock('../../../services/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
   },
}));

// Mock useRuntimeState
vi.mock('../../../hooks/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { useRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

const mockPlayerStats = {
  name: 'Test Character',
};

describe('CharSpellSlotLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the level number', () => {
    useRuntimeValue.mockReturnValue(null);

    render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should initialize availableSlots from storage when value exists', () => {
    useRuntimeValue.mockReturnValue(2);

    render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    expect(useRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        undefined
       );
      });

  it('should use totalSlots as default when storage value is null', () => {
    useRuntimeValue.mockReturnValue(null);

    render(
      <CharSpellSlotLevel
        level={2}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    expect(useRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_2',
        undefined
       );
      });

  it('should decrement available slots on click when slots are available', () => {
    useRuntimeValue.mockReturnValue(3);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    fireEvent.click(levelDiv);

    expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2,
        undefined
       );
      });

  it('should reset to totalSlots when availableSlots is 0', () => {
    useRuntimeValue.mockReturnValue(0);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    fireEvent.click(levelDiv);

    expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        3,
        undefined
       );
      });

  it('should not decrement on Tab key press', () => {
    useRuntimeValue.mockReturnValue(3);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    fireEvent.keyDown(levelDiv, { key: 'Tab' });

    expect(setRuntimeValue).not.toHaveBeenCalled();
     });

  it('should decrement on Enter key press', () => {
    useRuntimeValue.mockReturnValue(3);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    fireEvent.keyDown(levelDiv, { key: 'Enter' });

    expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2,
        undefined
       );
      });

  it('should render the correct number of slot divs', () => {
    useRuntimeValue.mockReturnValue(3);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const slots = container.querySelectorAll('.slot');
    expect(slots.length).toBe(4);
  });

  it('should mark slots as active when availableSlots > slot index', () => {
    useRuntimeValue.mockReturnValue(3);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const slots = container.querySelectorAll('.slot');
    expect(slots[0]).toHaveClass('active');
    expect(slots[1]).toHaveClass('active');
    expect(slots[2]).toHaveClass('active');
    expect(slots[3]).not.toHaveClass('active');
  });

  it('should mark all slots as inactive when availableSlots is 0 but totalSlots > 0', () => {
    useRuntimeValue.mockReturnValue(0);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const slots = container.querySelectorAll('.slot');
    expect(slots[0]).toHaveClass('inactive');
    expect(slots[1]).toHaveClass('inactive');
    expect(slots[2]).toHaveClass('inactive');
  });

  it('should not mark slots when totalSlots is 0', () => {
    useRuntimeValue.mockReturnValue(0);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={0}
        playerStats={mockPlayerStats}
       />
       );

    const slots = container.querySelectorAll('.slot');
    slots.forEach(slot => {
      expect(slot).not.toHaveClass('active');
      expect(slot).not.toHaveClass('inactive');
  });
     });

  it('should have clickable class and tabIndex', () => {
    useRuntimeValue.mockReturnValue(2);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    expect(levelDiv).toHaveClass('clickable');
    expect(levelDiv).toHaveAttribute('tabindex', '0');
  });
});