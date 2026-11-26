// @maintained-by-ai
// Item 4: the NPC row earns a labeled Print Card button next to the
// initiative verb. It must (a) never be gated — lore-only NPCs print a
// clean roleplay card too, (b) stop the row click from ALSO opening the
// editor, and (c) hand the row object straight to the container's handout
// state (the container owns the preview).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NPCListItem from './NPCListItem.jsx';

describe('NPCListItem — Print Card button', () => {
  const npc = {
    name: 'Marta Copperkettle',
    race: '',
    classRole: '',
    attitude: 'neutral',
    armorClass: null,
    hitPoints: null,
    actions: [],
  };

  const renderRow = (props = {}) => render(
    <NPCListItem
      npc={npc}
      campaignName="test-campaign"
      onEdit={vi.fn()}
      onAddToInitiative={vi.fn()}
      onPrintNPC={vi.fn()}
      {...props}
    />
  );

  it('labeled Print Card verb exists on a lore-only row (never gated)', () => {
    const onPrintNPC = vi.fn();
    renderRow({ onPrintNPC });
    const btn = screen.getByRole('button', { name: 'Print card for Marta Copperkettle' });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onPrintNPC).toHaveBeenCalledWith(expect.objectContaining({ name: 'Marta Copperkettle' }));
  });

  it('printing does not open the editor (row click swallowed)', () => {
    const onEdit = vi.fn();
    const onPrintNPC = vi.fn();
    renderRow({ onEdit, onPrintNPC });
    fireEvent.click(screen.getByRole('button', { name: 'Print card for Marta Copperkettle' }));
    expect(onPrintNPC).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
