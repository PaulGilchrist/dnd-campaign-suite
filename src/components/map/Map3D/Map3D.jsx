import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Map3DScene } from './map3dScene.js';
import { computeEffectiveWalls } from '../../../services/maps/effectiveWalls.js';
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

function Map3D({ campaignName, mapData, placedItems, characters, isLocalhost, fog, npcImages, overlays, onExit }) {
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
        });
    }, [ready, mapData, gridSize, walls, bgFill, placedItems, players, fog, isLocalhost, npcImages, playerAvatars]);

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

    const handleTopDown = useCallback(() => {
        sceneRef.current?.topDown();
    }, []);

    const counts = useMemo(() => {
        const wallCount = walls ? computeEffectiveWalls(walls, placedItems).size : 0;
        const items = (placedItems || []).filter((i) => i.type !== 'npc').length;
        const npcs = (placedItems || []).filter((i) => i.type === 'npc').length;
        const playerCount = (players || []).length;
        return `${wallCount} walls · ${items} items · ${playerCount} players · ${npcs} npcs`;
    }, [walls, placedItems, players]);

    return (
        <div className="map3d">
            <div className="toolbar-row no-print">
                <h4>{displayName || '3D Map'}</h4>
                <span className="map3d-counts">{counts}</span>
                <div className="toolbar no-print">
                    <button onClick={onExit} title="Back to 2D map">
                        <i className="fa-solid fa-map"></i> 2D
                    </button>
                    <button onClick={handleTopDown} title="Top-down view">
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
                <span>Left-drag to pan · Right-drag to orbit · Scroll to zoom</span>
            </div>
            <div className="map3d-viewport" ref={containerRef}>
                {initError && <div className="map3d-error">{initError}</div>}
                {!initError && !ready && <div className="map3d-loading">Loading 3D map…</div>}
            </div>
        </div>
    );
}

export default Map3D;
