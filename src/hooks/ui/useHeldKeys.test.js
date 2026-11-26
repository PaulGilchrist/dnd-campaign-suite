// @maintained-by-ai 2026-11-25
// useHeldKeys — the shared held-key camera pump (owner 2026-11-25, trackpad
// game-day lane). This file owns the hook's CONTRACT: press-and-hold pumps one
// onFrame per rAF tick with summed axes + dt, release stops the pump, the
// guard matrix (typing hosts, dialogs/menus, browser modifiers, disabled)
// never fires, R is a one-shot action ignoring auto-repeat, and handled keys
// are preventDefault'd. Axis INTERPRETATION (pan speed, orbit math) belongs to
// each consumer's tests (useZoomPan.test.js ×2, cameraStep.test.js).
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useHeldKeys from './useHeldKeys.js';

// Deterministic rAF ledger: callbacks queue until flush() runs them with a
// monotonically advancing clock (16ms/tick by default).
let rafQueue;
let clock;
beforeEach(() => {
    rafQueue = [];
    clock = 0;
    vi.stubGlobal('requestAnimationFrame', (cb) => { rafQueue.push(cb); return rafQueue.length; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
    vi.unstubAllGlobals();
});

const flush = (ticks = 1, ms = 16) => {
    for (let i = 0; i < ticks; i++) {
        const cbs = rafQueue;
        rafQueue = [];
        act(() => { cbs.forEach((cb) => { clock += ms; cb(clock); }); });
    }
};

const press = (code, opts = {}) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true, ...opts }));
});
const release = (code) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
});
const dispatchOn = (el, code) => {
    const ev = new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true });
    act(() => { el.dispatchEvent(ev); });
    return ev;
};

const setup = (opts = {}) => {
    const onFrame = vi.fn();
    const onAction = vi.fn();
    const utils = renderHook(() => useHeldKeys({ onFrame, onAction, ...opts }));
    return { onFrame, onAction, ...utils };
};

describe('useHeldKeys', () => {
    it('arms nothing while disabled — keys and R are totally inert', () => {
        const { onFrame, onAction } = setup({ enabled: false });
        press('KeyW');
        press('KeyR');
        flush(3);
        expect(onFrame).not.toHaveBeenCalled();
        expect(onAction).not.toHaveBeenCalled();
    });

    it('press-hold-release: first frame has dt 0, later frames carry real dt, pump stops after release', () => {
        const { onFrame } = setup();
        press('KeyW');
        expect(rafQueue.length).toBe(1);
        flush(1);
        expect(onFrame).toHaveBeenCalledTimes(1);
        expect(onFrame).toHaveBeenLastCalledWith({ forward: 1, strafe: 0, zoom: 0, shift: false, dt: 0 });
        flush(1);
        expect(onFrame).toHaveBeenLastCalledWith({ forward: 1, strafe: 0, zoom: 0, shift: false, dt: 0.016 });
        release('KeyW');
        flush(3);
        expect(onFrame).toHaveBeenCalledTimes(2);
    });

    it('arrow keys share the WASD axes; A/D strafe, W/S forward', () => {
        const { onFrame } = setup();
        press('ArrowRight');
        flush(1);
        expect(onFrame).toHaveBeenLastCalledWith({ forward: 0, strafe: 1, zoom: 0, shift: false, dt: 0 });
        release('ArrowRight');
        press('ArrowDown');
        flush(1);
        // dt continues from the still-running pump (release → re-press inside
        // one hold window) — only the axes are under test here.
        expect(onFrame).toHaveBeenLastCalledWith(
            expect.objectContaining({ forward: -1, strafe: 0, zoom: 0, shift: false }),
        );
    });

    it('opposing keys cancel to zero axes — no onFrame, but the pump keeps ticking', () => {
        const { onFrame } = setup();
        press('KeyA');
        press('KeyD');
        flush(2);
        expect(onFrame).not.toHaveBeenCalled();
        // Still pumping (a third key would join mid-hold): releasing both lets
        // the last queued tick drain without rescheduling.
        release('KeyA');
        release('KeyD');
        flush(1);
        expect(rafQueue.length).toBe(0);
    });

    it('+ / - and their numpad twins drive the zoom axis', () => {
        const { onFrame } = setup();
        press('Equal');
        flush(1);
        expect(onFrame).toHaveBeenLastCalledWith({ forward: 0, strafe: 0, zoom: 1, shift: false, dt: 0 });
        release('Equal');
        press('NumpadSubtract');
        flush(1);
        expect(onFrame).toHaveBeenLastCalledWith(
            expect.objectContaining({ forward: 0, strafe: 0, zoom: -1, shift: false }),
        );
    });

    it('reports the held-shift flag for the same frame payload', () => {
        const { onFrame } = setup();
        press('ShiftLeft');
        press('KeyD');
        flush(1);
        expect(onFrame).toHaveBeenLastCalledWith(
            expect.objectContaining({ strafe: 1, shift: true }),
        );
    });

    it('R fires onAction("reset") once per press, ignoring auto-repeat', () => {
        const { onAction } = setup();
        press('KeyR');
        press('KeyR', { repeat: true });
        press('KeyR', { repeat: true });
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onAction).toHaveBeenCalledWith('reset');
    });

    it('preventDefaults owned keys (arrows must never scroll the page)', () => {
        setup();
        const ev = new KeyboardEvent('keydown', { code: 'ArrowLeft', cancelable: true });
        act(() => { window.dispatchEvent(ev); });
        expect(ev.defaultPrevented).toBe(true);
    });

    describe('guard matrix', () => {
        it('ignores keystrokes with meta/ctrl/alt held', () => {
            const { onFrame, onAction } = setup();
            press('KeyW', { metaKey: true });
            press('KeyW', { ctrlKey: true });
            press('KeyR', { altKey: true });
            flush(2);
            expect(onFrame).not.toHaveBeenCalled();
            expect(onAction).not.toHaveBeenCalled();
        });

        it('ignores keys whose target sits in a text field or contenteditable', () => {
            const { onFrame } = setup();
            const input = document.createElement('input');
            const editable = document.createElement('div');
            editable.setAttribute('contenteditable', 'true');
            const renamer = document.createElement('div');
            renamer.appendChild(input);
            document.body.append(renamer, editable);
            expect(dispatchOn(input, 'KeyW').defaultPrevented).toBe(false);
            expect(dispatchOn(editable, 'ArrowUp').defaultPrevented).toBe(false);
            flush(2);
            expect(onFrame).not.toHaveBeenCalled();
            renamer.remove();
            editable.remove();
        });

        it('ignores keys focused inside an open dialog or role=menu', () => {
            const { onFrame, onAction } = setup();
            const dialog = document.createElement('div');
            dialog.setAttribute('role', 'dialog');
            const menu = document.createElement('div');
            menu.setAttribute('role', 'menu');
            const btn = document.createElement('button');
            const item = document.createElement('button');
            dialog.appendChild(btn);
            menu.appendChild(item);
            document.body.append(dialog, menu);
            dispatchOn(btn, 'KeyR');
            dispatchOn(item, 'ArrowDown');
            flush(2);
            expect(onFrame).not.toHaveBeenCalled();
            expect(onAction).not.toHaveBeenCalled();
            dialog.remove();
            menu.remove();
        });
    });

    it('releasing a key from OUTSIDE a guard still clears it (no stuck-strafe)', () => {
        const { onFrame } = setup();
        press('KeyD'); // armed normally
        flush(1);
        expect(onFrame).toHaveBeenCalledTimes(1);
        // Even if the keyup lands while some other handler thinks it owns the
        // key, our keyup listener never guards — the set must drain.
        act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' })); });
        flush(2);
        expect(onFrame).toHaveBeenCalledTimes(1);
    });

    it('unmount tears down listeners and the pump', () => {
        const { onFrame, unmount } = setup();
        press('KeyW');
        flush(1);
        expect(onFrame).toHaveBeenCalledTimes(1);
        unmount();
        press('KeyA');
        flush(2);
        expect(onFrame).toHaveBeenCalledTimes(1);
    });
});
