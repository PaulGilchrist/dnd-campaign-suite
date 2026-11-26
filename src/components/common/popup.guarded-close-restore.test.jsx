// @maintained-by-ai 2026-11-17
// Guarded close-side focus landing (GK 2026-11-17): the guarded (staged-HIT)
// face keeps its zero-pull-on-open law — opening moves NO focus, the chip that
// held it keeps it — but its CLOSE side no longer strands keyboard users at
// document root. Cancelling a staged attack unmounts the focused "Cancel
// attack" (or the guarded face's own Done) under activeElement, so the
// stranded-only restore now parks focus on the stamped tabindex="-1" fallback
// host (the overlay's parent, the same useMenuRoving host the dismissable
// tier's no-anchor lane uses) instead of BODY. A close where focus is still
// healthily parked (e.g. on the chip) is never fought; zero damage dispatches
// on cancel stays the void-guard law.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import Popup from './popup.jsx';
import AttackResultPopup from './AttackResultPopup.jsx';

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const overlay = () => screen.getByTestId('popup-overlay');
const panel = () => overlay().querySelector('.popup-modal');

// Flush the restore microtask AND its 0-ms fallback tick.
const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

// Mirrors the popup.close-restore harness: the chip both holds focus at open
// (jsdom clicks do not focus, so the test focuses where the law demands) and
// flips the state that mounts/unmounts the Popup — the real chip→staged→close
// sequence. The Cancel button inside children mirrors AttackResultPopup's
// staged face: the footer Done is suppressed, Cancel is an honest close exit.
function GuardedHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="mc-dice-link" role="button" tabIndex={0} data-testid="chip" onClick={() => setOpen(true)}>
        +4
      </span>
      {open && (
        <Popup dismissable={false} onClickOrKeyDown={() => setOpen(false)}>
          <b>HIT (18 vs AC 12)</b>
          <button type="button" onClick={() => setOpen(false)}>Cancel attack</button>
        </Popup>
      )}
    </>
  );
}

describe('Popup guarded close-restore', () => {
  it('guarded open moves NO focus: the chip keeps whatever held focus', async () => {
    render(<GuardedHarness />);
    const chip = screen.getByTestId('chip');
    chip.focus();
    fireEvent.click(chip);

    // Zero-pull contract: neither the panel nor any host steals the chip.
    expect(document.activeElement).toBe(chip);
    // Stamping while open is allowed (it never MOVES focus).
    expect(overlay().parentElement.getAttribute('tabindex')).toBe('-1');
    await settle();
    expect(document.activeElement).toBe(chip);
  });

  it('guarded close lands on the stamped tabindex="-1" host, never BODY', async () => {
    const { container } = render(<GuardedHarness />);
    // Live lane: a real browser pre-focuses the tabIndex=0 chip on mousedown,
    // but jsdom never moves focus on click — BODY holds it across the whole
    // staged exchange (zero pull keeps it there), the stranded-host lane.
    fireEvent.click(screen.getByTestId('chip'));
    expect(document.activeElement).toBe(document.body);
    expect(container.getAttribute('tabindex')).toBe('-1');

    fireEvent.click(screen.getByRole('button', { name: /Cancel attack/i }));
    await settle();
    expect(document.activeElement).toBe(container);
    expect(container.getAttribute('tabindex')).toBe('-1');
  });

  it('a close that leaves focus healthily parked is never fought', async () => {
    render(<GuardedHarness />);
    const chip = screen.getByTestId('chip');
    chip.focus();
    fireEvent.click(chip);

    fireEvent.click(screen.getByRole('button', { name: /Cancel attack/i }));
    await settle();
    // The stranded-only check stands down: focus never moved while open, so
    // the close tier leaves the chip alone.
    expect(document.activeElement).toBe(chip);
  });

  // ── Consumer lane: the real staged HIT face ──

  const AUTO_DAMAGE = { name: 'Scimitar', formula: '1d6 + 2', damageType: 'Slashing', source: 'Goblin 1', targetName: 'Wild_Sage_Druid' };

  function StagedHarness() {
    const [popupHtml, setPopupHtml] = useState({
      name: 'Scimitar',
      type: 'd20',
      rollType: 'attack',
      rolls: [18],
      bonus: 3,
      hit: true,
      autoDamage: AUTO_DAMAGE,
    });
    // Host lane mirrors MonsterCardModal POST-GK-2026-11-17: the popup's
    // parentElement wrapper stays mounted and only the Popup unmounts, so the
    // stamped fallback host survives the close (here the RTL container plays
    // the persistent-host role).
    return popupHtml && (
      <AttackResultPopup
        popupHtml={popupHtml}
        onClose={() => setPopupHtml(null)}
        campaignName="test-campaign"
        attackerName="Goblin 1"
        setPopupHtml={setPopupHtml}
      />
    );
  }

  let captured = [];
  const capture = (e) => captured.push(e.detail);

  async function stageAndClose(buttonName) {
    captured = [];
    window.addEventListener('dice-roll-done', capture);
    const { container } = render(<StagedHarness />);
    try {
      // Guarded face: no pull on open — BODY still owns focus while the
      // staged damage popup is up.
      expect(document.activeElement).not.toBe(panel());
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
      await settle();
      return container;
    } finally {
      window.removeEventListener('dice-roll-done', capture);
    }
  }

  it('staged HIT: Cancel attack lands on the stamped host, zero damage dispatch', async () => {
    const container = await stageAndClose(/Cancel attack/i);
    expect(document.activeElement).toBe(container);
    expect(container.getAttribute('tabindex')).toBe('-1');
    // Zero-commit contract: cancelling persists no damage lane at all.
    expect(captured).toHaveLength(0);
  });

  it('staged HIT: the face-own Done lands on the stamped host too (commit path)', async () => {
    const container = await stageAndClose(/^Done$/i);
    expect(document.activeElement).toBe(container);
    expect(container.getAttribute('tabindex')).toBe('-1');
    // Done is the COMMIT exit — its single dice-roll-done dispatch is existing
    // law; the focus contract is that neither guarded exit strands BODY.
    expect(captured).toHaveLength(1);
  });
});
