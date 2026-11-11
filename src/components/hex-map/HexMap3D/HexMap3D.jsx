import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Hex3DScene } from './hex3dScene.js';
import './HexMap3D.css';

// Read-only 3D diorama for outdoor hex maps — the outdoor twin of
// src/components/map/Map3D/Map3D.jsx. Same contract: 2D stays the editing/
// travel console (HexMap.jsx owns the viewMode swap); this view only
// visualises the loaded document. Structural inputs rebuild the board;
// party/travel-path/weather/toggles ride patch lanes so they can never
// re-frame the camera (the indoor camera-reset bug class).
function HexMap3D({
    displayName,
    hexCols, hexRows,
    terrain, rivers, roads, pois,
    partyPosition, travelPath, travelPathIndex,
    weather,
    isLocalhost,
    onExit,
}) {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [initError, setInitError] = useState(null);
    const [showLabels, setShowLabels] = useState(true);
    const [showWeather, setShowWeather] = useState(true);

    useEffect(() => {
        let scene = null;
        let disposed = false;
        (async () => {
            try {
                scene = new Hex3DScene(containerRef.current);
                await scene.init();
                if (disposed) {
                    scene.dispose();
                    return;
                }
                sceneRef.current = scene;
                setReady(true);
            } catch (e) {
                console.error('[HexMap3D] Failed to initialize WebGL:', e);
                if (!disposed) setInitError('WebGL is not available in this browser.');
            }
        })();
        return () => {
            disposed = true;
            if (scene) scene.dispose();
            sceneRef.current = null;
        };
    }, []);

    // Full scene rebuild: structural map inputs only. Party position, the
    // travel path, weather and the toggles all have their own patch effects
    // below — they must NOT tear down (and re-frame) the board.
    useEffect(() => {
        const scene = sceneRef.current;
        if (!ready || !scene) return;
        scene.buildMap({
            hexCols, hexRows,
            terrain: terrain || {},
            rivers: rivers || [],
            roads: roads || [],
            pois: pois || [],
            isLocalhost,
        });
    }, [ready, hexCols, hexRows, terrain, rivers, roads, pois, isLocalhost]);

    // Labels/Weather are visibility flags applied by setToggles — no rebuild.
    // Declared after the build effect so the first build sees the flags set.
    useEffect(() => {
        const scene = sceneRef.current;
        if (!ready || !scene) return;
        scene.setToggles({ showLabels, showWeather });
    }, [ready, showLabels, showWeather]);

    // Party marker + travel route are additive patch lanes (SSE travel ticks
    // patch in place; the camera never moves).
    useEffect(() => {
        const scene = sceneRef.current;
        if (!ready || !scene) return;
        scene.updateParty(partyPosition || null);
    }, [ready, partyPosition]);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!ready || !scene) return;
        scene.updateTravelPath(travelPath || [], travelPathIndex);
    }, [ready, travelPath, travelPathIndex]);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!ready || !scene) return;
        scene.setWeather(weather || null);
    }, [ready, weather]);

    // Dev-only automation handle (backlog 2026-11-10 HD): exposes the scene's
    // LIVE census (Hex3DScene.getCensus traverses the scene graph on every
    // read, so patch-lane writes show through with no remount). Behind
    // import.meta.env.DEV so production builds never ship the handle.
    useEffect(() => {
        if (!import.meta.env.DEV || !ready) return undefined;
        globalThis.__hexmap3d = {
            get census() {
                const scene = sceneRef.current;
                return scene ? scene.getCensus() : null;
            },
        };
        return () => { delete globalThis.__hexmap3d; };
    }, [ready]);

    const handleTopDown = useCallback(() => {
        sceneRef.current?.topDown();
    }, []);

    // Honest counts line (backlog 2026-11-02 BD): singular/plural per slot,
    // and the POI count mirrors the mesh lane — LAN players never see hidden
    // POIs so the line does not count them; the GM sees them dimmed, so the
    // total includes them with a "(N hidden)" qualifier.
    const counts = useMemo(() => {
        const plural = (n, singular, pluralForm = `${singular}s`) =>
            `${n} ${n === 1 ? singular : pluralForm}`;
        const poiList = pois || [];
        const hiddenPois = poiList.filter(p => p.visible === false).length;
        const poiCount = isLocalhost ? poiList.length : poiList.length - hiddenPois;
        const hiddenQualifier = isLocalhost && hiddenPois ? ` (${hiddenPois} hidden)` : '';
        return (
            `${plural(hexCols * hexRows, 'hex', 'hexes')} · `
            + `${plural(poiCount, 'POI')}${hiddenQualifier} · `
            + `${plural((roads || []).length, 'road')} · `
            + `${plural((rivers || []).length, 'river hex', 'river hexes')}`
        );
    }, [hexCols, hexRows, pois, roads, rivers, isLocalhost]);

    return (
        <div className="hex3d">
            <div className="toolbar-row no-print">
                <h4>{displayName || '3D Map'}</h4>
                <span className="hex3d-counts">{counts}</span>
                <div className="toolbar no-print">
                    {/* a11y tier mirrors Map3D.jsx (backlog 2026-11-01 AZ2):
                        aria-label mirrors the title so icon-ish text buttons
                        expose a meaningful accessible name; titles stay for
                        hover tooltips and the legacy getByTitle locators. */}
                    <button onClick={onExit} title="Back to 2D map" aria-label="Back to 2D map">
                        <i className="fa-solid fa-map"></i> 2D
                    </button>
                    <button onClick={handleTopDown} title="Top-down view" aria-label="Top-down view">
                        <i className="fa-solid fa-arrow-down"></i> Top-down
                    </button>
                    <label className="hex3d-toggle">
                        <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Labels
                    </label>
                    <label className="hex3d-toggle">
                        <input type="checkbox" checked={showWeather} onChange={(e) => setShowWeather(e.target.checked)} /> Weather
                    </label>
                </div>
            </div>
            {/* Camera affordance hint — sibling ABOVE the viewport so it never
                eats canvas pointer events (indoor .map3d-hint idiom). */}
            <div className="hex3d-hint no-print">
                <i className="fa-solid fa-circle-info"></i>
                <span>Left-drag to pan · Right-drag to orbit · Scroll to zoom</span>
            </div>
            <div className="hex3d-viewport" ref={containerRef}>
                {initError && <div className="hex3d-error">{initError}</div>}
                {!initError && !ready && <div className="hex3d-loading">Loading 3D map…</div>}
            </div>
        </div>
    );
}

export default HexMap3D;
