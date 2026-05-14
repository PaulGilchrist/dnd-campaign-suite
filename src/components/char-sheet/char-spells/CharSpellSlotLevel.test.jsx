import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';

// Mock the storage service with factory function
vi.mock('../../../services/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
   },
}));

import storage from '../../../services/storage.js';

const mockPlayerStats = {
  name: 'Test Character',
};

describe('CharSpellSlotLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the level number', () => {
    storage.getProperty.mockReturnValue(null);

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
    storage.getProperty.mockReturnValue(2);

    render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    expect(storage.getProperty).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1'
       );
     });

  it('should use totalSlots as default when storage value is null', () => {
    storage.getProperty.mockReturnValue(null);

    render(
      <CharSpellSlotLevel
        level={2}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    expect(storage.getProperty).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_2'
       );
     });

  it('should decrement available slots on click when slots are available', () => {
    storage.getProperty.mockReturnValue(3);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    fireEvent.click(levelDiv);

    expect(storage.setProperty).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2
       );
     });

  it('should reset to totalSlots when availableSlots is 0', () => {
    storage.getProperty.mockReturnValue(0);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    fireEvent.click(levelDiv);

    expect(storage.setProperty).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        3
       );
     });

  it('should not decrement on Tab key press', () => {
    storage.getProperty.mockReturnValue(3);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    fireEvent.keyDown(levelDiv, { key: 'Tab' });

    expect(storage.setProperty).not.toHaveBeenCalled();
     });

  it('should decrement on Enter key press', () => {
    storage.getProperty.mockReturnValue(3);

    const { container } = render(
      <CharSpellSlotLevel
        level={1}
        totalSlots={3}
        playerStats={mockPlayerStats}
       />
       );

    const levelDiv = container.querySelector('.level');
    fireEvent.keyDown(levelDiv, { key: 'Enter' });

    expect(storage.setProperty).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2
       );
     });

  it('should render the correct number of slot divs', () => {
    storage.getProperty.mockReturnValue(3);

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
    storage.getProperty.mockReturnValue(3);

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
    storage.getProperty.mockReturnValue(0);

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
    storage.getProperty.mockReturnValue(0);

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
    storage.getProperty.mockReturnValue(2);

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