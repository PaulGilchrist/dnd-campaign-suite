// @maintained-by-ai
// Unit tier for useOverlayEntranceFocus (backlog 2026-11-17: sp-overlay choosers
// left document.activeElement on BODY while open). Locks the composed house
// idioms: DeleteConfirmModal first-focusable entrance pull (disabled skipped,
// focus already inside never fought), useMenuRoving open-capture/close-restore
// (usable anchor wins, otherwise the tabindex="-1"-stamped parent fallback),
// and the deferred restore check so a surface that pulled focus while closing
// is never fought. Shape mirrors the app lane: a persistent .sheet parent that
// keeps living while closing UNMOUNTS the chooser child entirely (the state-
// flip close where CharSheet stops rendering renderPopup's output).
import React, { useRef } from 'react';
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useOverlayEntranceFocus } from './useOverlayEntranceFocus.js';

function ChooserHost({ ready = true, withFocusables = true }) {
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef, ready);
    return (
        <div className="sp-overlay" ref={overlayRef}>
            {withFocusables ? (
                <>
                    <button disabled>Disabled first</button>
                    <input aria-label="first" />
                    <input aria-label="second" />
                </>
            ) : (
                <p>Loading available creatures...</p>
            )}
        </div>
    );
}

// Toggle-shaped owner: permanently mounted, overlay div mounts/unmounts
// INSIDE its render with the flag — exactly the SSE listener shape.
function ListenerHost({ open }) {
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef, open);
    return (
        <div className="sheet">
            <p>listener never unmounts</p>
            {open ? (
                <div className="sp-overlay" ref={overlayRef}>
                    <input aria-label="first" />
                </div>
            ) : null}
        </div>
    );
}

function Sheet({ open = true, ...chooserProps }) {
    return (
        <div className="sheet">
            <p>sheet content stays mounted</p>
            {open ? <ChooserHost {...chooserProps} /> : null}
        </div>
    );
}

// Settle past the microtask restore and React's concurrent close work
// (benign test-only timer).
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

// Every test starts from a known focus state (jsdom can keep a detached
// element as activeElement across RTL's auto-cleanup).
const clearFocus = () => document.activeElement?.blur();

describe('useOverlayEntranceFocus', () => {
    it('pulls the first focusable, non-disabled element on open (BODY entrance closed)', () => {
        clearFocus();
        const { getByLabelText } = render(<Sheet />);
        // The disabled button sorts first in DOM order and must be skipped.
        expect(document.activeElement).toBe(getByLabelText('first'));
    });

    it('does not grab while not ready, then grabs when ready flips', async () => {
        clearFocus();
        const { getByLabelText, rerender } = render(<Sheet ready={false} />);
        clearFocus();
        await flush();
        expect(document.activeElement).toBe(document.body);
        rerender(<Sheet ready={true} />);
        expect(document.activeElement).toBe(getByLabelText('first'));
    });

    it('never fights focus already inside the overlay', () => {
        clearFocus();
        const { getByLabelText, rerender } = render(<Sheet ready={false} />);
        getByLabelText('second').focus();
        rerender(<Sheet ready={true} />);
        // Entrance would have picked 'first'; the already-inside 'second' wins.
        expect(document.activeElement).toBe(getByLabelText('second'));
    });

    it('no-ops without focusables (loading face) instead of throwing', async () => {
        clearFocus();
        render(<Sheet withFocusables={false} />);
        await flush();
        expect(document.activeElement).toBe(document.body);
    });

    it('restores to the usable pre-open anchor on close', async () => {
        clearFocus();
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { rerender } = render(<Sheet />);
        expect(document.activeElement.tagName).toBe('INPUT'); // entrance pulled inside
        rerender(<Sheet open={false} />);
        await flush();
        expect(document.activeElement).toBe(opener);
    });

    it('falls back to the tabindex-stamped parent sheet when no anchor exists (pointer open)', async () => {
        clearFocus(); // pointer open: focus lives on BODY
        const { container, rerender } = render(<Sheet />);
        const sheet = container.querySelector('.sheet');
        expect(sheet.getAttribute('tabindex')).toBe('-1');
        rerender(<Sheet open={false} />);
        await flush();
        expect(document.activeElement).toBe(sheet);
    });

    it('toggle-shaped listener: pull on ready-flip, restore on ready-fall WITHOUT owner unmount', async () => {
        // The always-mounted SSE listener lane (BardicInspirationReactionModal,
        // InlineChoiceModals): the overlay renders INSIDE a permanently mounted
        // owner only while its prompt flag is set, so the tier must key its
        // lifecycle to `ready` — never BODY at arrival, never BODY at dismissal.
        clearFocus();
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { rerender } = render(<ListenerHost open={false} />);
        rerender(<ListenerHost open={true} />);
        expect(document.activeElement).toBe(document.querySelector('[aria-label="first"]'));
        rerender(<ListenerHost open={false} />); // dismissal inside the STILL-mounted owner
        await flush();
        expect(document.activeElement).toBe(opener);
    });

    it('a ready-fall close is still never fought by a surface that claimed focus', async () => {
        clearFocus();
        const { rerender } = render(<ListenerHost open={true} />);
        rerender(<ListenerHost open={false} />);
        const popupBtn = document.createElement('button');
        document.body.appendChild(popupBtn);
        popupBtn.focus(); // wins before the restore microtask
        await flush();
        expect(document.activeElement).toBe(popupBtn);
    });

    it('never fights a surface that pulled focus on close', async () => {
        clearFocus();
        const { rerender } = render(<Sheet />);
        const popupBtn = document.createElement('button');
        document.body.appendChild(popupBtn);
        popupBtn.focus();
        rerender(<Sheet open={false} />);
        await flush();
        expect(document.activeElement).toBe(popupBtn);
    });
});
