// @maintained-by-ai 2026-11-26
// Regression lock for bug-wizard-discard-toll-escape-rearm-loop: a trusted
// Escape with focus inside the dirty-draft Discard toll settles the toll at
// React's #root delegate, React 19 flushes the unmount synchronously WITHIN
// that handler, and the same keydown then reaches useWizardEscape's WINDOW
// listener against an already-empty [role=dialog] DOM. The old DOM-census-only
// guard false-read "no dialog" and re-armed a byte-identical toll forever —
// Escape could never answer KEEP. The hook now ALSO bails when the keydown
// ORIGINATED inside a dialog (e.target.closest), which survives the flush
// because closest() walks the detached subtree's parent chain.
//
// jsdom cannot reproduce React 19's discrete-event flush order natively, so
// the race is SIMULATED: a second listener mounted on the toll's overlay
// detaches the dialog subtree mid-dispatch (exactly what the #root handler's
// synchronous unmount does live) before the event continues to window.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardEscape from './useWizardEscape.js';

// Build a toll-shaped dialog (DeleteConfirmModal chrome) with a Cancel button,
// mounted in the document. Returns { overlay, panel, cancel }.
function mountToll() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-shell-overlay';
  overlay.setAttribute('role', 'presentation');
  const panel = document.createElement('div');
  panel.className = 'modal-shell';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  panel.appendChild(cancel);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  return { overlay, panel, cancel };
}

// Simulate the live flush order: a listener at the overlay (standing in for
// React's #root delegate, which sits above the window listener in the bubble
// path) detaches the toll subtree synchronously during the SAME keydown.
function unmountTollMidDispatch(overlay) {
  const flush = (e) => {
    if (e.key === 'Escape') overlay.remove();
  };
  overlay.addEventListener('keydown', flush);
  return flush;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useWizardEscape: child-dialog suppression (discard-toll re-arm loop)', () => {
  it('a toll unmounted by the SAME keydown (React-19 flush race) does NOT re-arm the close ask', () => {
    const onRequestClose = vi.fn();
    renderHook(() => useWizardEscape(onRequestClose));

    const { overlay, cancel } = mountToll();
    unmountTollMidDispatch(overlay);

    // Escape originates on the Cancel button inside the dialog; the overlay
    // listener detaches the subtree before the window listener runs, so the
    // DOM census alone would see zero dialogs and re-ask.
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    cancel.dispatchEvent(event);

    expect(document.querySelector('[role="dialog"]')).toBeNull(); // race staged
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('a MOUNTED dialog still suppresses via the DOM census even when the target is outside it', () => {
    const onRequestClose = vi.fn();
    renderHook(() => useWizardEscape(onRequestClose));

    mountToll();

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.body.dispatchEvent(event);

    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('with no dialog anywhere the Escape still routes to the close lane exactly once', () => {
    const onRequestClose = vi.fn();
    renderHook(() => useWizardEscape(onRequestClose));

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('a document-target Escape (nothing focused) with no dialog still closes', () => {
    // The origin guard must not swallow targets that are not Elements.
    const onRequestClose = vi.fn();
    renderHook(() => useWizardEscape(onRequestClose));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Escape keys regardless of origin', () => {
    const onRequestClose = vi.fn();
    renderHook(() => useWizardEscape(onRequestClose));

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('unmount removes the window listener (no leak)', () => {
    const onRequestClose = vi.fn();
    const { unmount } = renderHook(() => useWizardEscape(onRequestClose));
    unmount();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
