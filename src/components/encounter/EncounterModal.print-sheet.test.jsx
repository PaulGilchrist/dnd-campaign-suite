// @maintained-by-ai
/* Item 4 — the Load list earns a labeled Print verb per saved row. Pressing
 * it opens the paper preview portal with the sheet derived from THAT SAVED
 * ROW plus the host's live bestiary/party — and it is a pure read: no load,
 * no PUT, no XP recompute dispatch (the load seam's updateEncounter recompute
 * must stay untouched and unreached). The list survives the preview (the
 * sheet is a sibling overlay), and Escape answers only the preview. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EncounterModal from './EncounterModal.jsx';

const saved = [
  {
    name: 'goblin-ambush',
    savedAt: '2024-01-01T00:00:00Z',
    selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }],
    description: 'Ambush at the **crossing**.',
    effectiveXP: 100,
  },
];

const goblin = { index: 'goblin', name: 'Goblin', armor_class: 15, hit_points: 7, speed: { walk: '30 ft.' }, challenge_rating: '0.25', xp: 50 };

describe('EncounterModal — printed sheet lane', () => {
  beforeEach(() => {
    cleanup();
    global.fetch = vi.fn(() => Promise.reject(new Error('no fetch from the sheet lane')));
  });

  const renderLoadModal = (props = {}) => render(
    <EncounterModal
      isOpen
      onClose={vi.fn()}
      mode="load"
      onSave={vi.fn()}
      onLoad={vi.fn()}
      onDelete={vi.fn()}
      onRename={vi.fn()}
      encounters={saved}
      loading={false}
      monsters={[goblin]}
      playerLevels={[1, 1]}
      {...props}
    />
  );

  it('every saved row carries a labeled Print button', () => {
    renderLoadModal();
    const btn = screen.getByRole('button', { name: 'Print sheet for "goblin-ambush"' });
    expect(btn).toBeEnabled();
    expect(btn.textContent).toContain('Print');
  });

  it('Print opens the paper portal with the derived roster — and dispatches NOTHING', () => {
    const onLoad = vi.fn();
    renderLoadModal({ onLoad });
    fireEvent.click(screen.getByRole('button', { name: 'Print sheet for "goblin-ambush"' }));
    const portal = document.body.querySelector('.handout-preview-portal');
    expect(portal).not.toBeNull();
    expect(portal.textContent).toContain('Encounter: goblin-ambush');
    expect(portal.textContent).toContain('Goblin');
    expect(portal.textContent).toContain('1/4'); // CR derived from the bestiary row
    expect(onLoad).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('the Load list stays mounted under the sheet and the Close verb drops the sheet', () => {
    renderLoadModal();
    fireEvent.click(screen.getByRole('button', { name: 'Print sheet for "goblin-ambush"' }));
    expect(screen.getByRole('button', { name: 'Load "goblin-ambush"' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(document.body.querySelector('.handout-preview-portal')).toBeNull();
    // The Load modal itself survives the sheet close.
    expect(screen.getByRole('button', { name: 'Load "goblin-ambush"' })).toBeInTheDocument();
  });

  it('rows stay action-disabled during a list refresh, Print included', () => {
    renderLoadModal({ loading: true });
    expect(screen.getByRole('button', { name: 'Print sheet for "goblin-ambush"' })).toBeDisabled();
  });
});
