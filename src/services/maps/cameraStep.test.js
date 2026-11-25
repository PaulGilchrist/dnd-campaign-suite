// @maintained-by-ai
// applyCameraStep — the shared 3D keyboard-camera math (no WebGL, no three).
// Fake camera/controls expose exactly the surface OrbitControls r160 gives:
// camera.position {x,y,z,set}, controls.target, controls.update(). Pins the
// axis contract: zoom scales the offset, strafe/orbit moves theta, forward
// tilts phi, shift translates camera AND target on the ground plane (offset
// invariant), degenerate top-down never divides by zero, and no-ops never
// touch update().
import { describe, it, expect, vi } from 'vitest';
import { applyCameraStep } from './cameraStep.js';

const vec = (x, y, z) => ({
    x, y, z,
    set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; },
});
const setup = (px, py, pz, tx = 0, ty = 0, tz = 0) => {
    const camera = { position: vec(px, py, pz) };
    const controls = { target: vec(tx, ty, tz), update: vi.fn() };
    return { camera, controls };
};
const dist = ({ camera, controls }) => {
    const p = camera.position, t = controls.target;
    return Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z);
};

// Tilted start: r = √(100²+100²+100²), theta = atan2(100,100) = π/4.
const tilted = () => setup(100, 100, 100);

describe('applyCameraStep', () => {
    it('no-ops (returns false, no update) for missing inputs, dt=0, and zero axes', () => {
        expect(applyCameraStep(null, null, { dt: 0.016 })).toBe(false);
        const a = tilted();
        expect(applyCameraStep(a.controls, a.camera, { dt: 0 })).toBe(false);
        expect(applyCameraStep(a.controls, a.camera, { dt: 0.016 })).toBe(false);
        expect(applyCameraStep(a.controls, a.camera, { dt: 0.016, shift: true })).toBe(false);
        expect(a.controls.update).not.toHaveBeenCalled();
    });

    it('zoom +1 dollies IN exponentially: distance *= exp(-rate·dt) along the same ray', () => {
        const s = tilted();
        const before = dist(s);
        expect(applyCameraStep(s.controls, s.camera, { zoom: 1, dt: 0.5 })).toBe(true);
        expect(dist(s)).toBeCloseTo(before * Math.exp(-0.5), 6);
        // Same direction (offset stayed proportional).
        const p = s.camera.position;
        expect(p.x / p.y).toBeCloseTo(1, 6);
        expect(p.z / p.y).toBeCloseTo(1, 6);
        expect(s.controls.update).toHaveBeenCalledTimes(1);
    });

    it('zoom -1 dollies OUT symmetrically', () => {
        const s = tilted();
        const before = dist(s);
        applyCameraStep(s.controls, s.camera, { zoom: -1, dt: 0.5 });
        expect(dist(s)).toBeCloseTo(before * Math.exp(0.5), 6);
    });

    it('strafe +1 (D) decreases azimuth theta by rate·dt, radius and polar held', () => {
        const s = tilted();
        const r = dist(s);
        applyCameraStep(s.controls, s.camera, { strafe: 1, dt: 0.5 });
        const p = s.camera.position;
        expect(Math.atan2(p.x, p.z)).toBeCloseTo(Math.PI / 4 - 1.6 * 0.5, 6);
        expect(dist(s)).toBeCloseTo(r, 6);
        expect(p.y).toBeCloseTo(100, 6);
    });

    it('forward +1 (W) tilts toward top-down: polar decreases, height rises', () => {
        const s = tilted();
        const r = dist(s);
        applyCameraStep(s.controls, s.camera, { forward: 1, dt: 0.25 });
        const p = s.camera.position;
        const phi = Math.acos(p.y / dist(s));
        expect(phi).toBeLessThan(Math.acos(100 / r));
        expect(p.y).toBeGreaterThan(100);
        expect(dist(s)).toBeCloseTo(r, 6);
    });

    it('polar stays inside (0, π) — a long tilt never flips the pole', () => {
        const s = tilted();
        for (let i = 0; i < 40; i++) applyCameraStep(s.controls, s.camera, { forward: -1, dt: 0.05 });
        const phi = Math.acos(Math.min(1, Math.max(-1, s.camera.position.y / dist(s))));
        expect(phi).toBeLessThan(Math.PI - 0.001 + 1e-9);
        expect(phi).toBeGreaterThan(0);
    });

    it('shift + forward TRANSLATES camera and target together on the ground plane (offset invariant, Y untouched)', () => {
        const s = setup(100, 120, 300); // looking toward -Z-ish: forward = -(x,z)
        const ox = s.camera.position.x - s.controls.target.x;
        const oz = s.camera.position.z - s.controls.target.z;
        applyCameraStep(s.controls, s.camera, { forward: 1, dt: 0.5, shift: true });
        const step = dist(s) * 0.9 * 0.5; // PAN_RATE · r · dt, r unchanged
        // Ground-forward unit: target - pos projected = (-100, -300) normalized.
        const fl = Math.hypot(100, 300);
        expect(s.controls.target.x).toBeCloseTo(0 + (-100 / fl) * step, 6);
        expect(s.controls.target.z).toBeCloseTo(0 + (-300 / fl) * step, 6);
        expect(s.controls.target.y).toBe(0);
        expect(s.camera.position.x - s.controls.target.x).toBeCloseTo(ox, 6);
        expect(s.camera.position.z - s.controls.target.z).toBeCloseTo(oz, 6);
        expect(s.camera.position.y).toBe(120);
    });

    it('shift + strafe pans along right = forward × up', () => {
        const s = setup(0, 100, 100); // straight south: ground-forward = (0,-1)
        applyCameraStep(s.controls, s.camera, { strafe: 1, dt: 1, shift: true });
        // right = (fx,0,fz)×(0,1,0) = (-fz,0,fx) = (1,0,0)? fx=0,fz=-1 → (1,0,0).
        expect(s.controls.target.x).toBeGreaterThan(0);
        expect(s.controls.target.z).toBeCloseTo(0, 9);
    });

    it('degenerate straight-down view still pans along a stable fallback (-Z)', () => {
        const s = setup(0, 200, 0.01);
        applyCameraStep(s.controls, s.camera, { forward: 1, dt: 0.5, shift: true });
        expect(s.controls.target.z).toBeLessThan(0);
        expect(s.controls.target.x).toBeCloseTo(0, 9);
    });

    it('shift + zoom + orbit compose: pan moves the pair, rotation and dolly hit the offset', () => {
        const s = tilted();
        applyCameraStep(s.controls, s.camera, { forward: 1, strafe: 1, zoom: 1, shift: true, dt: 0.25 });
        // shift-pan consumed the motion axes; only the dolly scaled the offset.
        const before = Math.hypot(100, 100, 100);
        expect(dist(s)).toBeCloseTo(before * Math.exp(-0.25), 6);
        // The tilted start has symmetric x/z, so the pan lands on z (mx
        // = fx·forward − fz·strafe cancels exactly): z must have moved.
        expect(s.controls.target.z).not.toBe(0);
        expect(s.camera.position.y).toBeGreaterThan(s.controls.target.y);
    });
});
