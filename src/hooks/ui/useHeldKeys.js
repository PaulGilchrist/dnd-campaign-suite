import { useEffect, useRef } from 'react';

// Shared held-key camera driver for every map surface (indoor/hex 2D pan+zoom
// and the two 3D scenes' orbit/dolly/pan lanes). Design goal (owner
// 2026-11-25, trackpad game-day ergonomics): pressing WASD/arrows/+/- moves
// the view IMMEDIATELY and keeps moving smoothly while held — no click to
// focus the canvas first, and none of the ~500 ms auto-repeat lurch that
// raw keydown-repeat gives. The hook therefore tracks the pressed-key SET and
// pumps requestAnimationFrame only while keys are down; consumers get one
// onFrame({ forward, strafe, zoom, shift, dt }) per animation frame and
// interpret the axes per surface (2D: shift = 2× speed; 3D: shift = pan-mode
// orbit swap). dt is seconds, capped at 0.05 s so a
// backgrounded tab never teleports the camera.
//
// Intuitiveness guards (the lane must NEVER eat keys that belong to typing or
// focused widgets): keydown is ignored when a browser modifier (meta/ctrl/alt)
// is held, when the event target sits inside a text field / contenteditable,
// or inside an open [role=dialog]/[role=menu] (rename editors, confirm modals,
// the context-menu arrow roving keep their keys). keyup ALWAYS releases from
// the set so a guard-blocked or out-of-window release can never strand a
// stuck key. Handled codes are preventDefault'd so arrows never scroll the
// page underneath the map.
//
// This is UI-only animation (the no-game-timers law): nothing here advances,
// expires, or resolves GAME state — the consumers' setters are the same ones
// the mouse lanes already use.

const AXIS_CODES = {
    KeyW: ['forward', 1], ArrowUp: ['forward', 1],
    KeyS: ['forward', -1], ArrowDown: ['forward', -1],
    KeyA: ['strafe', -1], ArrowLeft: ['strafe', -1],
    KeyD: ['strafe', 1], ArrowRight: ['strafe', 1],
    // '=' is the unshifted '+' key; numpad variants ride the same axis.
    Equal: ['zoom', 1], NumpadAdd: ['zoom', 1],
    Minus: ['zoom', -1], NumpadSubtract: ['zoom', -1],
};
const SHIFT_CODES = new Set(['ShiftLeft', 'ShiftRight']);
const ACTION_CODES = { KeyR: 'reset' };

// Text-entry hosts and modal/menu roots whose focused descendants own keys.
function isKeyStealer(target) {
    if (!(target instanceof Element)) return false;
    if (target.isContentEditable) return true;
    return !!target.closest(
        'input, textarea, select, [contenteditable], [role="dialog"], [role="menu"]'
    );
}

function useHeldKeys({ enabled = true, onFrame, onAction } = {}) {
    // Latest callbacks in refs so the listeners subscribe exactly once per
    // `enabled` flip, never re-binding on parent re-renders.
    const onFrameRef = useRef(onFrame);
    const onActionRef = useRef(onAction);
    onFrameRef.current = onFrame;
    onActionRef.current = onAction;

    useEffect(() => {
        if (!enabled) return undefined;
        const pressed = new Set();
        let raf = 0;
        let last = 0;

        const axes = () => {
            const out = { forward: 0, strafe: 0, zoom: 0 };
            for (const code of pressed) {
                const axis = AXIS_CODES[code];
                if (axis) out[axis[0]] += axis[1];
            }
            return out;
        };

        const pump = (now) => {
            raf = 0;
            const a = axes();
            const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
            last = now;
            if (a.forward || a.strafe || a.zoom) {
                onFrameRef.current?.({
                    ...a,
                    // One shift flag; each surface interprets it (2D = 2×
                    // speed, 3D = pan-mode orbit swap).
                    shift: pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
                    dt,
                });
            }
            // Keep pumping while ANY tracked key (shift included) is still
            // down, so adding a second key mid-hold never restarts late.
            if (pressed.size) raf = requestAnimationFrame(pump);
            else last = 0;
        };

        const handleKeyDown = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (isKeyStealer(e.target)) return;
            const action = ACTION_CODES[e.code];
            if (action) {
                if (!e.repeat) onActionRef.current?.(action);
                e.preventDefault();
                return;
            }
            if (AXIS_CODES[e.code] || SHIFT_CODES.has(e.code)) {
                const fresh = !pressed.has(e.code);
                pressed.add(e.code);
                // Only stop the page from scrolling/zooming once we actually
                // own this key; the first press also (re)arms the frame pump.
                e.preventDefault();
                if (fresh && !raf) raf = requestAnimationFrame(pump);
            }
        };
        const handleKeyUp = (e) => {
            pressed.delete(e.code);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (raf) cancelAnimationFrame(raf);
            pressed.clear();
        };
    }, [enabled]);
}

export default useHeldKeys;
