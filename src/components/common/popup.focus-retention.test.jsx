// @maintained-by-ai
// Focus-retention regression (bug-roll-result-popup-escape-inert-when-opened-over-stat-modal):
// a roll-RESULT face opens over the monster stat modal; the roll commit's SSE
// echo bumps runtimeStateTick, the initiative card re-keys (key
// `${name}-${runtimeStateTick}`) and its MonsterNameAutocomplete refocuses
// itself on remount — AFTER the Popup's once-per-mount focus pull. Pre-fix that
// stranded activeElement outside the still-mounted panel, making the
// 28e103710 Escape dismissal silently inert on that face (backdrop unaffected;
// manual panel.focus()+Escape closed). The dismissable close now KEEPS the
// panel while it is open; guarded (staged-damage) faces still never move focus.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Popup from './popup.jsx';

const panel = () => screen.getByTestId('popup-overlay').querySelector('.popup-modal');

// The panel keydown handler only sees Escape while focus lives inside the
// panel, so the whole bug reduces to: does focus survive the post-mount steal?
const stealToCardNameInput = (container) => {
  // Native focus() so jsdom dispatches focusout/focusin exactly like the
  // live card re-key remount does.
  container.querySelector('.monster-autocomplete-input').focus();
};

describe('Popup focus retention while open', () => {
  it('re-claims the panel when a card re-key remount steals focus after open', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <>
        <Popup html="<b>✗ MISS (6 vs AC 12)</b>" onClickOrKeyDown={handleClose} />
        <input className="monster-autocomplete-input" aria-label="Goblin name" />
      </>
    );

    // Open-time pull worked (this leg shipped in 28e103710)…
    expect(document.activeElement).toBe(panel());

    // …then the roll-commit tick REMOUNTS the card behind the modal (the bug).
    stealToCardNameInput(container);
    expect(document.activeElement).toBe(panel());

    // A trusted Escape therefore lands on the panel and dismisses.
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('guarded (staged-damage) faces never pull focus back — no-focus-steal law kept', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <>
        <Popup html="<b>HIT</b>" onClickOrKeyDown={handleClose} dismissable={false} />
        <input className="monster-autocomplete-input" aria-label="Goblin name" />
      </>
    );

    stealToCardNameInput(container);
    expect(document.activeElement).toBe(
      container.querySelector('.monster-autocomplete-input')
    );

    // Escape with focus outside the panel stays inert on guarded faces too.
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('never strands focus outside the popup layer when a second popup mounts above', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    const { container } = render(
      <>
        <Popup html="<b>First face</b>" onClickOrKeyDown={closeA} />
        <Popup html="<b>Stacked face</b>" onClickOrKeyDown={closeB} />
        <input className="monster-autocomplete-input" aria-label="Goblin name" />
      </>
    );

    stealToCardNameInput(container);
    // Whichever panel ends up holding focus, focus must be back INSIDE the
    // popup layer (no trap ping-pong leaving it on the stolen input).
    const insidePopupLayer = screen
      .getAllByTestId('popup-overlay')
      .some((overlay) => overlay.contains(document.activeElement));
    expect(insidePopupLayer).toBe(true);
  });
});
