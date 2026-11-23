import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LootRevealModal from './LootRevealModal.jsx';

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

  it('reveals every generated line plus the honest XP split', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Loot reveal' });
    loot.forEach((line) => expect(dialog).toHaveTextContent(line));
    // 1600 / 2 characters = 800 each, printed beside the total.
    expect(dialog).toHaveTextContent('1,600 XP');
    expect(dialog).toHaveTextContent('800 per character');
  });

  it('empty lines and the shared no-loot sentinel are never revealed; a zero-XP haul shows no XP line', () => {
    open({ lootEntries: ['', '  ', 'No loot for these monsters', 'A chipped gem'], totalEncounterXp: 0 });
    const dialog = screen.getByRole('dialog', { name: 'Loot reveal' });
    expect(dialog.querySelectorAll('li')).toHaveLength(1);
    expect(dialog).not.toHaveTextContent('No loot');
    expect(dialog).not.toHaveTextContent('XP');
  });

  it('Award to Party routes to the caller (which arms the two-step confirm)', () => {
    const onAward = vi.fn();
    open({ onAward });
    fireEvent.click(screen.getByRole('button', { name: /Award to Party/ }));
    expect(onAward).toHaveBeenCalledTimes(1);
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
