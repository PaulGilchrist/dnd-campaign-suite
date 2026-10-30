import { useState, useEffect, useRef, useCallback } from 'react';
import { isEqual } from 'lodash';
import * as mapsService from '../../../services/maps/mapsService';
import { DEFAULT_GRID_SIZE } from '../../../config/mapConfig';

const AUTOSAVE_DEBOUNCE_MS = 1000;

// Drop undefined-valued keys so the payload byte-matches what the server
// stores and echoes back (JSON.stringify omits them). Without this, a fresh
// drop's `rotation: undefined` (useMapDrops.js:83) made the own-write SSE
// echo compare deep-UNEQUAL to the last-saved payload and slip past the
// dirty gate as a byte-identical replay PUT.
function jsonSafeEntry(entry) {
    const out = {};
    for (const [key, value] of Object.entries(entry)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
}

function buildSavePayload(mapData, gridSize, placedItems) {
    return {
        ...mapData,
        gridSize,
        walls: Array.from(mapData.walls || []),
        placedItems: (placedItems || []).map(jsonSafeEntry),
    };
}

function useMapLoader({ campaignName, characters, mapName, gridSize, setGridSize, isLocalhost = true }) {
    const [mapData, setMapData] = useState(null);
    const [placedItems, setPlacedItems] = useState([]);
    const svgLoadInProgressRef = useRef(false);
    const loadedMapNameRef = useRef(null);
    const pendingSaveRef = useRef(null);
    const saveTimerRef = useRef(null);
    // Dirty-tracking baseline: the last document bytes this instance is known
    // to have given the server (adopted on load, claimed on every flush). The
    // autosave effect compares each candidate payload against it and skips
    // zero-edit writes (mount re-save #800 + SSE-echo re-post churn).
    const lastSavedRef = useRef(null);

    const clearSaveTimer = () => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    };

    const flushSave = useCallback(() => {
        // Read-only (network) clients never author the map document — flushSave
        // is the sole save chokepoint (autosave debounce + pointer-up/leave +
        // unmount flush all route here). Live in the repro a LAN player tab PUT
        // the whole document seconds after a GM fog reset, resurrecting fogged
        // cells (bug-player-clients-clobber-fog-reset). Players still RECEIVE every
        // change via SSE (useSSESync); they just never WRITE. The server route now
        // 403s indoor-map writes from non-localhost as defense-in-depth.
        if (!isLocalhost) {
            pendingSaveRef.current = null;
            clearSaveTimer();
            return;
        }
        clearSaveTimer();
        const pending = pendingSaveRef.current;
        if (!pending) return;
        pendingSaveRef.current = null;
        lastSavedRef.current = pending.dataToSave;
        mapsService.saveMapData(pending.campaignName, pending.mapName, pending.dataToSave)
            .catch(err => console.error('Failed to save map data:', err));
    }, [isLocalhost]);

    useEffect(() => {
        if (loadedMapNameRef.current === mapName) return;
        loadedMapNameRef.current = mapName;
        svgLoadInProgressRef.current = true;

        const loadMap = async () => {
            let loadRejected = false;
            try {
                const existing = await mapsService.loadMapData(campaignName, mapName);
                if (existing) {
                    const walls = existing.walls ? new Set(existing.walls) : new Set();
                    const loadedData = { ...existing, walls, revealed: existing.revealed || [] };
                    const loadedGridSize = existing.gridSize || DEFAULT_GRID_SIZE;
                    const loadedPlacedItems = existing.placedItems || [];
                    setMapData(loadedData);
                    setGridSize(loadedGridSize);
                    setPlacedItems(loadedPlacedItems);
                    // The loaded document IS the server's bytes — seed the dirty
                    // baseline so the autosave effect sees a zero-edit open as clean.
                    lastSavedRef.current = buildSavePayload(loadedData, loadedGridSize, loadedPlacedItems);

                    if (characters && characters.length > 0) {
                        const charNames = new Set(characters.map(c => c.name));
                        const existingPlayers = loadedData.players || [];
                        const reconciled = existingPlayers.filter(p => charNames.has(p.name));
                        if (reconciled.length !== existingPlayers.length) {
                            setMapData(prev => ({ ...prev, players: reconciled }));
                        }
                    }
                    return;
                }
            } catch (err) {
                // No-silent-fallback law (fix#337S #798): fall through to empty-map
                // creation, but LOUD — swallowed load errors were invisible before.
                console.error('Failed to load map data (falling through to fresh map):', err);
                loadRejected = true;
            }

            const newData = { players: [], walls: new Set() };
            setMapData(newData);
            setPlacedItems([]);
            if (loadRejected) {
                // A REJECTED load must never auto-persist (bug-hex-poi-enter-
                // deleted-map-phantom-resurrect): entering a stale POI link used
                // to mount this blank document and the open-time save PUT the
                // deleted file back as a nameless/typeless ghost. Render the
                // empty grid, seed the dirty baseline with the exact payload the
                // autosave effect would emit so a zero-edit open writes NOTHING,
                // and let the first real edit persist via the normal debounced
                // lane (user intent re-creates the document on purpose).
                lastSavedRef.current = buildSavePayload(newData, gridSize, []);
            } else if (isLocalhost) {
                // A falsy resolve is the legacy "no document yet" create lane
                // (every real create flow POSTs the file first, so its load
                // resolves with bytes). Persist it once — baseline seeded with
                // the SAME builder so the mount re-check compares clean instead
                // of re-PUTting a Set-vs-array-mismatched twin document.
                const dataToSave = buildSavePayload(newData, gridSize, []);
                lastSavedRef.current = dataToSave;
                mapsService.saveMapData(campaignName, mapName, dataToSave).catch(err => console.error('Failed to save initial map data:', err));
            }
            // Read-only (network) clients render the empty grid locally but must
            // not create/overwrite the document (that authorship belongs to the
            // GM). See bug-player-clients-clobber-fog-reset.
        };

        loadMap().finally(() => { svgLoadInProgressRef.current = false; });
    }, [campaignName, characters, mapName, gridSize]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const pending = pendingSaveRef.current;
        if (pending && (pending.mapName !== mapName || pending.campaignName !== campaignName)) {
            flushSave();
        }
        if (!mapData) return;
        if (svgLoadInProgressRef.current) return;
        const dataToSave = buildSavePayload(mapData, gridSize, placedItems);
        const queued = pendingSaveRef.current;
        if (queued && queued.mapName === mapName && queued.campaignName === campaignName
            && isEqual(queued.dataToSave, dataToSave)) {
            return; // identical document already scheduled (e.g. SSE echo of own
                    // write re-set state) — let the existing debounce fire once
        }
        if (isEqual(dataToSave, lastSavedRef.current)) {
            // Zero-edit state churn (fresh load, echo, undone stroke): nothing
            // is dirtied against the server — drop any stale queue, write
            // nothing (backlog 2026-10-26: mount + echo emitted 2 no-op PUTs).
            pendingSaveRef.current = null;
            clearSaveTimer();
            return;
        }
        pendingSaveRef.current = { campaignName, mapName, dataToSave };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushSave, AUTOSAVE_DEBOUNCE_MS);
    }, [mapData, campaignName, gridSize, placedItems, mapName, flushSave]);

    useEffect(() => flushSave, []); // eslint-disable-line react-hooks/exhaustive-deps

    return { mapData, setMapData, placedItems, setPlacedItems, loadInProgressRef: svgLoadInProgressRef, flushSave };
}

export default useMapLoader;
