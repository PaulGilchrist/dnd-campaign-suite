// @maintained-by-ai 2026-11-17
// Close-restore regression (backlog 2026-11-17 sp-overlay adoption, second
// half): the open-pull (28e103710) parks focus on the panel, but every close
// path used to leave activeElement stranded on BODY — FI re-witnessed exactly
// this after a MISS-popup Escape over the GM stat modal. The Popup close now
// restores the pre-open anchor via the same stranded-only, never-fighting
// microtask+macrotask idiom as useOverlayEntranceFocus / useMenuRoving: an
// anchor-less open falls back to the stamped parent host, and a surface that
// claimed focus itself after the popup opened is never fought.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import Popup from './popup.jsx';

const panel = () => screen.getByTestId('popup-overlay').querySelector('.popup-modal');

// Consumer-conditional mount: the opener button both (a) is the anchor a real
// click focuses before the roll commits, and (b) flips the state that mounts
// the Popup — mirroring the live chip→result sequence. Every dismissal path
// then funnels through the host's state flip, like the real close lanes.
function Harness({ dismissable = true }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" data-testid="anchor" onClick={() => setOpen(true)}>
                Open roll
            </button>
            <input className="monster-autocomplete-input" aria-label="Goblin name" />
            {open && (
                <Popup
                    html="<b>✗ MISS (6 vs AC 12)</b>"
                    dismissable={dismissable}
                    onClickOrKeyDown={() => setOpen(false)}
                />
            )}
        </>
    );
}

// Open with the anchor owning focus (jsdom click does not focus, so focus
// explicitly first — the browser mousedown pre-focuses a real button anyway).
const openFromAnchor = () => {
    const anchor = screen.getByTestId('anchor');
    anchor.focus();
    fireEvent.click(anchor);
    return anchor;
};

// Flush the restore microtask AND its 0-ms fallback tick.
const settle = async () => {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
    });
};

describe('Popup close-restore', () => {
    it('Escape-close restores the pre-open anchor instead of stranding on BODY', async () => {
        render(<Harness />);
        const anchor = openFromAnchor();
        // Open-pull owns the panel (existing law).
        expect(document.activeElement).toBe(panel());

        fireEvent.keyDown(document.activeElement, { key: 'Escape' });
        await settle();
        expect(document.activeElement).toBe(anchor);
    });

    it('Done-button close restores the anchor', async () => {
        render(<Harness />);
        const anchor = openFromAnchor();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        await settle();
        expect(document.activeElement).toBe(anchor);
    });

    it('pure backdrop close restores the anchor', async () => {
        render(<Harness />);
        const anchor = openFromAnchor();

        const overlay = screen.getByTestId('popup-overlay');
        fireEvent.mouseDown(overlay);
        fireEvent.click(overlay);
        await settle();
        expect(document.activeElement).toBe(anchor);
    });

    it('anchor-less open restores the stamped fallback host, never BODY', async () => {
        const { container } = render(<Harness />);
        // No pre-open focus: the mount is the mouse click on the button, and
        // jsdom keeps activeElement on BODY — the stamped-host lane.
        fireEvent.click(screen.getByTestId('anchor'));
        expect(document.activeElement).toBe(panel());

        fireEvent.keyDown(panel(), { key: 'Escape' });
        await settle();
        expect(container.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(container);
    });

    it('a surface that claims focus itself after close is never fought', async () => {
        render(<Harness />);
        openFromAnchor();
        const other = document.querySelector('.monster-autocomplete-input');

        fireEvent.keyDown(panel(), { key: 'Escape' });
        // The new focus-owner wins the race synchronously BEFORE the restore
        // microtask runs — the stranded-only check must then stand down.
        other.focus();
        await settle();
        expect(document.activeElement).toBe(other);
    });

    it('guarded (staged-damage) faces never capture or restore focus', () => {
        render(<Harness dismissable={false} />);
        const anchor = openFromAnchor();
        // Guarded chrome never pulls (existing law) — the anchor keeps the
        // focus it already had, so the close tier has nothing to move.
        expect(document.activeElement).toBe(anchor);
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });
});
