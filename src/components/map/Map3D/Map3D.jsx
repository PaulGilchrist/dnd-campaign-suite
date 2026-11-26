import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Map3DScene } from './map3dScene.js';
import { buildCensusLine } from './map3dCensus.js';
import useHeldKeys from '../../../hooks/ui/useHeldKeys.js';
import './Map3D.css';

// Mirrors Players.jsx getPlayerImage: resolve a player's portrait to a
// URL the TextureLoader can fetch (campaign-relative or absolute http).
function computePlayerAvatars(players, characters, campaignName) {
    const avatars = {};
    for (const player of players || []) {
        const character = (characters || []).find((c) => c.name === player.name);
        const relativePath = character?.imagePath;
        if (!relativePath) continue;
        if (relativePath.startsWith('http')) {
            avatars[player.id] = relativePath;
        } else if (campaignName) {
            avatars[player.id] = `campaigns/${campaignName}/${relativePath}`;
        }
    }
    return avatars;
}

function Map3D({ campaignName, mapData, placedItems, characters, isLocalhost, fog, npcImages, overlays, ghostCells, onExit }) {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [initError, setInitError] = useState(null);
    const [showLabels, setShowLabels] = useState(true);
    const [showTorch, setShowTorch] = useState(true);

    const { gridSize, walls, players, bgFill, displayName } = mapData || {};

    const playerAvatars = useMemo(
        () => computePlayerAvatars(players, characters, campaignName),
        [players, characters, campaignName]
    );

    useEffect(() => {
        let scene = null;
        let disposed = false;
        (async () => {
            try {
                scene = new Map3DScene(containerRef.current);
                await scene.init();
                if (disposed) {
                    scene.dispose();
                    return;
                }
                sceneRef.current = scene;
                setReady(true);
            } catch (e) {
                console.error('[Map3D] Failed to initialize WebGL:', e);
                if (!disposed) setInitError('WebGL is not available in this browser.');
            }
        })();
        return () => {
            disposed = true;
            if (scene) scene.dispose();
            sceneRef.current = null;
        };
    }, []);

    // Full scene rebuild: structural map inputs only. Overlays and the
    // Labels/Torch toggles have their own lightweight effects below — they
    // must NOT tear down (and re-frame) the whole scene.
    //
    // Token cosmetics (Item 5) are DELIBERATELY NOT honored here — stated
    // precisely so the deviation is documented, not silent: per-token ring
    // color, per-token label visibility, and the dashed condition ring are
    // 2D-only in 3D. Why: those three all read the per-character RUNTIME
    // buckets (tokenCosmetics / activeConditions + campaign targetEffects)
    // through React's useRuntimeValue subscription lane; the scene-build
    // lane consumes plain map-document props filtered by the PURE shared
    // predicates in map3dVisibility.js (fog/hidden laws) and holds no store
    // access — feeding per-creature store values across the WebGL boundary
    // would mean fabricating a second cosmetics/conditions plumbing lane
    // whose every edit also tears down the full scene via the buildMap dep
    // array (expensive, and against the never-a-second-source-of-truth law
    // this file's census pattern exists to protect). The 3D board keeps its
    // OWN honest global Labels toggle (scene.setToggles), which is view
    // state, not personalization; the 2D/3D parity the app promises covers
    // the visibility/fog/ghost laws (map3dCensus), not per-token cosmetics.
    useEffect(() => {
        const scene = sceneRef.current;
        if (!ready || !scene || !mapData) return;
        scene.buildMap({
            gridSize: gridSize || 30,
            walls: walls ? Array.from(walls) : [],
            items: placedItems || [],
            players: players || [],
            fog: fog || new Set(),
            isLocalhost,
            npcImages,
            playerAvatars,
            bgFill,
            // Last-seen ghost lane (Item 7 3D parity): the SAME hoisted
            // ghostCells value the 2D PlacedItems lane consumes (computed in
            // Map.jsx above the viewMode conditional — no second position
            // model). null on the GM/toggle-OFF lane; the scene key is named
            // lastKnown so it never entangles with the fallback-prop "ghost"
            // vocabulary in map3dScene.js.
            lastKnown: ghostCells || null,
        });
    }, [ready, mapData, gridSize, walls, bgFill, placedItems, players, fog, isLocalhost, npcImages, playerAvatars, ghostCells]);

    // Labels/Torch are visibility flags applied by setToggles — no rebuild.
    // Declared after the build effect so the first build sees the flags set.
    useEffect(() => {
        const scene = sceneRef.current;
        if (!ready || !scene) return;
        scene.setToggles({ showLabels, showTorch });
    }, [ready, showLabels, showTorch]);

    // Spell overlays are an additive sub-layer patched in place. mapData is a
    // dep so a not-yet-built scene (overlays arriving before the map) repaints
    // once the map lands and re-positions volumes for the new grid size.
    useEffect(() => {
        const scene = sceneRef.current;
        if (!ready || !scene || !mapData) return;
        scene.updateSpellOverlays(overlays || []);
    }, [ready, mapData, overlays]);

    // Dev-only automation handle (backlog 2026-11-10 HD): exposes the scene's
    // LIVE census (Map3DScene.getCensus traverses the scene graph on every
    // read, so overlay adds/clears and rebuilds show through with no remount).
    // Behind import.meta.env.DEV so production builds never ship the handle.
    useEffect(() => {
        if (!import.meta.env.DEV || !ready) return undefined;
        globalThis.__map3d = {
            get census() {
                const scene = sceneRef.current;
                return scene ? scene.getCensus() : null;
            },
        };
        return () => { delete globalThis.__map3d; };
    }, [ready]);

    const handleTopDown = useCallback(() => {
        sceneRef.current?.topDown();
    }, []);

    // Keyboard camera lane (trackpad game-day, owner 2026-11-25): WASD/arrows
    // orbit, +/- dolly, Shift+WASD ground-pans, R jumps to top-down. Armed
    // once the scene is live; the shared useHeldKeys guards (typing targets,
    // dialogs/menus, browser modifiers) keep it from ever hijacking keys.
    useHeldKeys({
        enabled: ready,
        onFrame: useCallback((input) => sceneRef.current?.stepCamera(input), []),
        onAction: useCallback((action) => {
            if (action === 'reset') sceneRef.current?.topDown();
        }, []),
    });

    // Header census: mirrors the LIVE scene per origin (owner ruling
    // 2026-11-20 "count only live-visible"). map3dCensus derives every term
    // from the same visibility predicates the scene's _buildNpcs/
    // _buildPlacedItems/_buildLastKnownTokens dispatch applies, so a token
    // culled (hidden/fogged) or ghosted for a visitor never masquerades as a
    // live count — ghosts surface as a separate `N last known` term. The GM
    // lane passes every gate, so it keeps the full doc counts. Reactive deps
    // are exactly the scene-rebuild inputs, so the line live-updates on
    // token/fog/ghost changes with no remount.
    const counts = useMemo(
        () => buildCensusLine({ walls, placedItems, players, fog, isLocalhost, ghostCells: ghostCells || null }),
        [walls, placedItems, players, fog, isLocalhost, ghostCells]
    );

    return (
        <div className="map3d">
            <div className="toolbar-row no-print">
                <h4>{displayName || '3D Map'}</h4>
                <span className="map3d-counts">{counts}</span>
                <div className="toolbar no-print">
                    {/* aria-labels (backlog 2026-11-01 AZ2, a11y parity with the
                        8b8897db3 MusicPlayer pattern): the visible text ("2D",
                        "Top-down") is a poor accessible name, so mirror the
                        title; titles stay for hover tooltips and the legacy
                        getByTitle locators. */}
                    <button onClick={onExit} title="Back to 2D map" aria-label="Back to 2D map">
                        <i className="fa-solid fa-map"></i> 2D
                    </button>
                    <button onClick={handleTopDown} title="Top-down view" aria-label="Top-down view">
                        <i className="fa-solid fa-arrow-down"></i> Top-down
                    </button>
                    <label className="map3d-toggle">
                        <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Labels
                    </label>
                    <label className="map3d-toggle">
                        <input type="checkbox" checked={showTorch} onChange={(e) => setShowTorch(e.target.checked)} /> Torch light
                    </label>
                </div>
            </div>
            {/* Camera affordance hint (backlog 2026-10-29-AE): OrbitControls are
                invisible until discovered — mirror the .travel-panel-hint idiom
                with a one-line muted chip in the toolbar chrome, ABOVE the
                viewport so it never eats canvas pointer events. Mouse mapping
                lives in map3dScene.js (LEFT pan / RIGHT orbit / wheel zoom). */}
            <div className="map3d-hint no-print">
                <i className="fa-solid fa-circle-info"></i>
                <span>Left-drag to pan · Right-drag to orbit · Scroll to zoom · WASD/arrows rotate · +/- zoom · Shift+WASD pan · R top-down</span>
            </div>
            <div className="map3d-viewport" ref={containerRef}>
                {initError && <div className="map3d-error">{initError}</div>}
                {!initError && !ready && <div className="map3d-loading">Loading 3D map…</div>}
            </div>
        </div>
    );
}

export default Map3D;
