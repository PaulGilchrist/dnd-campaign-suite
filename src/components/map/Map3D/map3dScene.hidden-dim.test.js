// @maintained-by-ai: 2026-11-01
// ─── Lane: 3D GM hidden-marker dim ───────────────────────────────────────────
// _setDimmed is the 3D mirror of the 2D GM hidden dim (backlog 2026-11-01
// AZ2: the lanes had drifted to 0.5 vs 0.4 — now ONE shared
// HIDDEN_MARKER_OPACITY in config/mapConfig.js). Real THREE headless scene
// (no WebGLRenderer), seam copied from map3dScene.overlays.test.js.

import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { Map3DScene } from './map3dScene.js';
import { HIDDEN_MARKER_OPACITY } from '../../../config/mapConfig.js';

describe('Map3DScene._setDimmed (GM hidden-marker dim)', () => {
    const scene = () => {
        const s = new Map3DScene({ clientWidth: 100, clientHeight: 100 });
        s.THREE = THREE;
        return s;
    };

    it('dims every mesh material to the shared HIDDEN_MARKER_OPACITY', () => {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));

        scene()._setDimmed(group);

        expect(mat.transparent).toBe(true);
        expect(mat.opacity).toBe(HIDDEN_MARKER_OPACITY);
    });
});
