// @maintained-by-ai 2026-11-17
// Entrance/restore focus tier lock for MassHealModal (backlog 2026-11-17
// sp-overlay census adoption — the named representative of the mass-heal/
// Prayer-of-Healing chooser family). Live rides proved the shared
// CreatureSelectionModal lane (Bolstering Treats chooser) and the sibling
// shapes; this file pins the MassHealModal face itself: opening pulls the
// first focusable (target checkbox) INSIDE the .sp-overlay — never BODY —
// and the Skip dismissal restores focus out of BODY onto the pre-open anchor.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import MassHealModal from './MassHealModal.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: () => undefined,
}));

const baseProps = {
  creatureTargets: [
    { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
    { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
  ],
  maxTargets: 2,
  pool: 20,
  campaignName: 'test-campaign',
  combatSummary: null,
};

// Parent-flag mount law (HealingModals.jsx `{massHealModal && <MassHealModal/>}`):
// the opener button is the anchor a real click focuses before state flips.
function Host({ onSkip }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sheet">
      <button type="button" onClick={() => setOpen(true)}>Mass Heal:</button>
      {open && (
        <MassHealModal
          {...baseProps}
          onConfirm={vi.fn()}
          onSkip={() => { setOpen(false); onSkip(); }}
        />
      )}
    </div>
  );
}

const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

describe('MassHealModal entrance focus tier', () => {
  beforeEach(() => {
    document.activeElement?.blur();
  });

  it('opens with focus INSIDE the overlay and Skip-close restores the anchor', async () => {
    const onSkip = vi.fn();
    render(<Host onSkip={onSkip} />);
    const opener = screen.getByText('Mass Heal:');
    opener.focus();
    fireEvent.click(opener);

    const overlay = document.querySelector('.sp-overlay');
    expect(overlay).toBeTruthy();
    // Entrance pull: first focusable, non-disabled element inside the overlay.
    expect(overlay.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.sp-overlay')).toBeNull();
    await flush();
    // Stranded-close: focus is back on the anchor, never BODY.
    expect(document.activeElement).toBe(opener);
  });

  it('never fights a surface that claimed focus after open', async () => {
    render(<Host onSkip={vi.fn()} />);
    fireEvent.click(screen.getByText('Mass Heal:'));
    const overlay = document.querySelector('.sp-overlay');
    expect(overlay.contains(document.activeElement)).toBe(true);
    const outside = screen.getByText('Mass Heal:');
    outside.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await flush();
    expect(document.activeElement).toBe(outside);
  });
});
