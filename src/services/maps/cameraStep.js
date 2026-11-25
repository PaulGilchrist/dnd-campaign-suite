// Shared keyboard-camera math for both 3D scenes (Map3DScene / Hex3DScene) —
// the trackpad game-day lane (owner 2026-11-25). Pure numbers on the live
// camera + OrbitControls objects, so it is unit-testable without WebGL and
// never duplicated between the two scene files.
//
// three r160 OrbitControls exposes no public rotate/dolly setters, BUT its
// update() re-derives the spherical from the CURRENT camera offset every call
// and then clamps phi into [minPolarAngle, maxPolarAngle] and the radius into
// [minDistance, maxDistance]. So the supported programmatic lane is exactly
// what this does: rewrite camera.position around controls.target, then let
// controls.update() absorb/clamp it — damping keeps the motion fluid.
//
// Axis interpretation (matches the on-screen hint chips); `input` is the raw
// useHeldKeys frame { forward, strafe, zoom, shift, dt } (absent axes read
// as 0, dt is required):
//  • no shift: strafe +1 (D) orbits the camera around the target, forward +1
//    (W) tilts toward top-down (polar decreases);
//  • shift: camera AND target translate together on the ground plane (screen
//    pan), step scaled by orbit distance so panning feels 1:1 at any zoom;
//  • zoom +1 (+/=) dollies in: distance *= exp(-rate·dt), clamped by update().

const ROTATE_RATE = 1.6; // rad/s
const DOLLY_RATE = 1.0;  // log-distance per second (holding '+' ≈ 2.7× closer/s)
const PAN_RATE = 0.9;    // fraction of orbit distance per second

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Shift-pan: translate the target along ground-projected forward/right unit
// vectors (right = forward × up, +Y up; degenerate straight-down view keeps a
// stable -Z forward). The camera follows — the caller re-applies the (zoom-
// scaled) offset to the moved target.
function panOnGround(target, off, input, step) {
    const f = input.forward || 0;
    const s = input.strafe || 0;
    if (!f && !s) return;
    let fx = -off.x;
    let fz = -off.z;
    const fl = Math.hypot(fx, fz);
    if (fl > 1e-9) { fx /= fl; fz /= fl; } else { fx = 0; fz = -1; }
    target.x += (fx * f - fz * s) * step;
    target.z += (fz * f + fx * s) * step;
}

// Orbit: theta/polar re-derived the same way three's Spherical does
// (theta = atan2(x, z), phi = acos(y/r)), stepped, then rebuilt at radius r.
function orbitOffset(off, r, input) {
    const oldR = Math.hypot(off.x, off.y, off.z);
    const phi = clamp(
        Math.acos(clamp(off.y / oldR, -1, 1)) - (input.forward || 0) * ROTATE_RATE * input.dt,
        0.001, Math.PI - 0.001,
    );
    const theta = Math.atan2(off.x, off.z) - (input.strafe || 0) * ROTATE_RATE * input.dt;
    const sp = Math.sin(phi);
    return { x: r * sp * Math.sin(theta), y: r * Math.cos(phi), z: r * sp * Math.cos(theta) };
}

export function applyCameraStep(controls, camera, input) {
    if (!controls || !camera || !input || !input.dt) return false;
    const target = controls.target;
    const pos = camera.position;
    const off = { x: pos.x - target.x, y: pos.y - target.y, z: pos.z - target.z };
    const oldR = Math.hypot(off.x, off.y, off.z);
    if (oldR < 1e-9) return false;
    if (!input.forward && !input.strafe && !input.zoom) return false;
    const r = input.zoom ? oldR * Math.exp(-input.zoom * DOLLY_RATE * input.dt) : oldR;
    let next;
    if (input.shift) {
        // Pan consumes the motion axes; only the dolly scales the offset.
        next = { x: off.x * (r / oldR), y: off.y * (r / oldR), z: off.z * (r / oldR) };
        panOnGround(target, off, input, r * PAN_RATE * input.dt);
    } else if (input.forward || input.strafe) {
        next = orbitOffset(off, r, input);
    } else if (input.zoom) {
        const s = r / oldR;
        next = { x: off.x * s, y: off.y * s, z: off.z * s };
    } else {
        return false;
    }
    pos.set(target.x + next.x, target.y + next.y, target.z + next.z);
    controls.update();
    return true;
}

export default applyCameraStep;
