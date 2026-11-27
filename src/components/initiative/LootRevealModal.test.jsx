// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LootRevealModal from './LootRevealModal.jsx';
import { NO_LOOT_SENTINEL } from '../../services/items/lootGenerator.js';

describe('LootRevealModal', () => {
  beforeEach(() => cleanup());

  const loot = ['120 gp', 'Ruby (50 gp)', '+1 Shortsword'];

  const open = (props = {}) =>
    render(
      <LootRevealModal
        lootEntries={loot}
        totalEncounterXp={1600}
        characters={[{ name: 'A' }, { name: 'B' }]}
        onClose={() => {}}
        onAward={() => {}}
        {...props}
      />
    );

  it('reveals every generated line plus the honest XP split, floored', () => {
    open({ totalEncounterXp: 1000, characters: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    const dialog = screen.getByRole('dialog', { name: 'Loot reveal' });
    loot.forEach((line) => expect(dialog).toHaveTextContent(line));
    // 1000 / 3 characters = 333 each (never rounded up), printed beside the total.
    expect(dialog).toHaveTextContent('1,000 XP');
    expect(dialog).toHaveTextContent('333 per character');
  });

  it('empty lines and the shared no-loot sentinel are never revealed; a zero-XP haul shows no XP line', () => {
    open({
      lootEntries: ['', '  ', NO_LOOT_SENTINEL, 'A chipped gem'],
      totalEncounterXp: 0,
    });
    const dialog = screen.getByRole('dialog', { name: 'Loot reveal' });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('A chipped gem');
    expect(dialog).not.toHaveTextContent(NO_LOOT_SENTINEL);
    expect(dialog).not.toHaveTextContent('XP');
  });

  it('Award to Party routes to the caller without itself closing (the parent arms the confirm)', () => {
    const onAward = vi.fn();
    const onClose = vi.fn();
    open({ onAward, onClose });
    fireEvent.click(screen.getByRole('button', { name: /Award to Party/ }));
    expect(onAward).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Keep editing, the close ×, the backdrop, and Escape all route to onClose', () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    fireEvent.click(screen.getByTitle('Close (Esc)'));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('.loot-reveal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('a click inside the dialog is not a backdrop close', () => {
    const onClose = vi.fn();
    open({ onClose });
    fireEvent.click(screen.getByRole('dialog', { name: 'Loot reveal' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
