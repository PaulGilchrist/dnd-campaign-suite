import { useState, useEffect, useRef, useCallback } from 'react';
import { isEqual } from 'lodash';
import * as mapsService from '../../../services/maps/mapsService.js';
import { hexKey } from '../../../services/maps/hexMapUtils.js';
import { getDailyHexBudget } from '../../../services/campaign/travelService.js';
import { DEFAULT_GRID_SIZE, GRID_COLS_MULTIPLIER, MIN_ZOOM, DEFAULT_TERRAIN } from '../../../config/outdoorConfig.js';

// Coalescing window for the autosave chokepoint (mirrors the indoor lane's
// AUTOSAVE_DEBOUNCE_MS in src/components/map/hooks/useMapLoader.js).
const HEX_AUTOSAVE_DEBOUNCE_MS = 1000;

// The one envelope shape the persistence effect writes; load paths seed the
// dirty baseline with this SAME builder so a zero-edit open compares equal and
// skips the full-document PUT (backlog 2026-10-26 write-amplification twin of
// the indoor lane — outdoor emitted six no-op PUTs per open).
function buildHexEnvelope({ displayName, gridSize, terrain, rivers, roads, pois, zoom, panX, panY, marchingOrder, partyPosition, weather, travelState }) {
    return {
        type: 'outdoor',
        displayName,
        gridSize,
        terrain,
        rivers,
        roads,
        pois,
        zoom,
        panX,
        panY,
        marchingOrder,
        partyPosition,
        weather,
        travelState,
    };
}

function normalizeExistingView(existing) {
    const loadedZoom = existing.zoom != null ? Math.max(MIN_ZOOM, existing.zoom) : MIN_ZOOM;
    const isOldDefault = existing.panX === 0 && existing.panY === 0;
    const loadedPanX = (!isOldDefault && existing.panX != null) ? existing.panX : 0;
    const loadedPanY = (!isOldDefault && existing.panY != null) ? existing.panY : 0;
    return { loadedZoom, loadedPanX, loadedPanY, isOldDefault };
}

function buildTravelInit(loadedTravel) {
    return {
        forcedMarchHours: typeof loadedTravel.forcedMarchHours === 'number' ? loadedTravel.forcedMarchHours : 0,
        accruedCost: typeof loadedTravel.accruedCost === 'number' ? loadedTravel.accruedCost : 0,
        dailyBudget: typeof loadedTravel.dailyBudget === 'number' ? loadedTravel.dailyBudget : getDailyHexBudget(loadedTravel.travelPace || 'normal'),
        travelMode: loadedTravel.travelMode || 'inactive',
        travelPace: loadedTravel.travelPace || 'normal',
        destination: loadedTravel.destination || null,
        path: Array.isArray(loadedTravel.path) ? loadedTravel.path : [],
        pathIndex: typeof loadedTravel.pathIndex === 'number' ? loadedTravel.pathIndex : 0,
        // Noon's exhausted flag is part of the resumable snapshot the write
        // back publishes (improve 2026-10-26-D); dropping it here desynced
        // the file lane from change-data and re-dirtied the document on the
        // first quiet reload after an over-budget reject.
        dayExhausted: !!loadedTravel.dayExhausted,
    };
}

function resolveLoadedCollections(existing) {
    return {
        loadedTerrain: existing.terrain || {},
        loadedRivers: existing.rivers || [],
        loadedRoads: existing.roads || [],
        loadedPois: existing.pois || [],
        loadedGridSize: existing.gridSize || DEFAULT_GRID_SIZE,
    };
}

function applyExistingMap(existing, mapName, characters, ctx) {
    const { loadedTerrain, loadedRivers, loadedRoads, loadedPois, loadedGridSize } = resolveLoadedCollections(existing);
    const { loadedZoom, loadedPanX, loadedPanY, isOldDefault } = normalizeExistingView(existing);

    if (!existing.type) existing.type = 'outdoor';

    ctx.setMapData(existing);
    ctx.setGridSize(loadedGridSize);
    ctx.setTerrain(loadedTerrain);
    ctx.setRivers(loadedRivers);
    ctx.setRoads(loadedRoads);
    ctx.setPois(loadedPois);
    ctx.setZoom(loadedZoom);
    ctx.setPanX(loadedPanX);
    ctx.setPanY(loadedPanY);
    ctx.hexMapDisplayNameRef.current = existing.displayName || mapName;
    if (existing.weather) ctx.setWeather(existing.weather);

    const travelInitData = buildTravelInit(existing.travelState || {});
    const hasActiveTravel = travelInitData.travelMode !== 'inactive' || travelInitData.destination !== null;
    ctx.resumedTripRef.current = hasActiveTravel;
    if (hasActiveTravel) {
        ctx.setTravelInit(travelInitData);
        // The file carries a live trip: adopt it into the save ref BEFORE the
        // baseline seed below (which reads it) so the bytes are exactly what
        // the publisher re-emits on resume (deep-equal ⇒ a quiet resume emits
        // zero PUTs) while a later unrelated edit (pan, terrain) re-writes the
        // same travelState instead of clobbering it back to null
        // (improve 2026-10-26-D).
        ctx.travelStateRef.current = travelInitData;
        ctx.resumedTripRef.current = true;
    }

    if (isOldDefault) {
        ctx.needsResetViewRef.current = true;
    }

    const loadOrder = existing.marchingOrder ||
        (characters.length > 0 ? characters.map(c => c.name) : []);
    ctx.setMarchingOrder(loadOrder);

    const loadedPartyPos = existing.partyPosition || {
        q: Math.floor((loadedGridSize * GRID_COLS_MULTIPLIER) / 2),
        r: Math.floor(loadedGridSize / 2),
    };
    ctx.setPartyPosition(loadedPartyPos);

    // Seed the dirty baseline with the normalized loaded snapshot (same
    // builder the persistence effect uses) so opening a map without edits
    // writes nothing.
    ctx.lastSavedRef.current = buildHexEnvelope({
        displayName: existing.displayName || mapName,
        gridSize: loadedGridSize,
        terrain: loadedTerrain,
        rivers: loadedRivers,
        roads: loadedRoads,
        pois: loadedPois,
        zoom: loadedZoom,
        panX: loadedPanX,
        panY: loadedPanY,
        marchingOrder: loadOrder,
        partyPosition: loadedPartyPos,
        weather: existing.weather || null,
        travelState: ctx.travelStateRef.current,
    });

    // Claim the held-bytes name BEFORE setLoading(false): the persistence
    // guard (:201) compares live mapName against this ref, and the flush
    // that #800 made deterministic rides the loading-state flip — so the ref
    // must already read `mapName` by the time that commit's effects run.
    ctx.hexMapNameRef.current = mapName;

    // setLoading(false) rides the SAME update batch as every loaded-state
    // setter above, so the persistence effect (guarded on `loading`) runs
    // exactly once with this loaded snapshot in its closure.
    ctx.setLoading(false);
}

function buildInitialMapData(characters) {
    const initialTerrain = {};
    const newCols = DEFAULT_GRID_SIZE * GRID_COLS_MULTIPLIER;
    const newRows = DEFAULT_GRID_SIZE;
    for (let r = 0; r < newRows; r++) {
        for (let q = 0; q < newCols; q++) {
            initialTerrain[hexKey(q, r)] = DEFAULT_TERRAIN;
        }
    }

    const initialOrder = characters.length > 0 ? characters.map(c => c.name) : [];
    const initialPartyPos = initialOrder.length > 0
        ? { q: Math.floor(newCols / 2), r: Math.floor(newRows / 2) }
        : null;

    const newData = {
        type: 'outdoor',
        gridSize: DEFAULT_GRID_SIZE,
        terrain: initialTerrain,
        pois: [],
        roads: [],
        zoom: MIN_ZOOM,
        marchingOrder: initialOrder,
        partyPosition: initialPartyPos,
    };

    return { initialTerrain, initialOrder, initialPartyPos, newData };
}

async function createAndSaveNewMap(campaignName, mapName, characters, ctx) {
    const { initialTerrain, initialOrder, initialPartyPos, newData } = buildInitialMapData(characters);

    ctx.setMapData(newData);
    ctx.setTerrain(initialTerrain);
    ctx.setGridSize(DEFAULT_GRID_SIZE);
    ctx.setMarchingOrder(initialOrder);
    ctx.setPartyPosition(initialPartyPos);
    ctx.setZoom(MIN_ZOOM);
    ctx.setPanX(0);
    ctx.setPanY(0);
    ctx.needsResetViewRef.current = true;
    // A fresh map's display name is its own mapName — reclaim it so an
    // in-place switch cannot carry the previous map's displayName into the
    // new map's save envelope (#801).
    ctx.hexMapDisplayNameRef.current = mapName;
    ctx.resumedTripRef.current = false;

    try {
        await mapsService.saveMapData(campaignName, mapName, newData);
        // Create landed: seed the persistence effect's envelope shape as the
        // dirty baseline so the loading-flip commit does NOT schedule a
        // second, normalization-only re-PUT of the same document
        // (backlog 2026-10-26). Envelope extras (displayName/pan/weather/
        // travelState) ride along with the next real edit.
        ctx.lastSavedRef.current = buildHexEnvelope({
            displayName: mapName,
            gridSize: DEFAULT_GRID_SIZE,
            terrain: initialTerrain,
            rivers: [],
            roads: [],
            pois: [],
            zoom: MIN_ZOOM,
            panX: 0,
            panY: 0,
            marchingOrder: initialOrder,
            partyPosition: initialPartyPos,
            weather: null,
            travelState: ctx.travelStateRef.current,
        });
    } catch (err) {
        // Create failed — keep the baseline null so the loading-flip
        // persistence pass retries the full envelope (no silent data loss).
        ctx.lastSavedRef.current = null;
        console.error('Failed to save initial hex map data:', err);
    }

    // Claim the held-bytes name before the loading flip so the #800 flush
    // commit passes the persistence name guard (:201) — see applyExistingMap.
    ctx.hexMapNameRef.current = mapName;

    // Flipping `loading` here is the ONLY post-load signal the persistence
    // effect needs: it is state, so the re-render it causes re-runs that
    // effect deterministically with the fresh snapshot in its closure —
    // no ref/await-seam split (#800).
    ctx.setLoading(false);
}

function useMapLoader(campaignName, mapName, characters) {
    const [loading, setLoading] = useState(true);
    const [mapData, setMapData] = useState(null);
    const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
    const [terrain, setTerrain] = useState({});
    const [rivers, setRivers] = useState([]);
    const [roads, setRoads] = useState([]);
    const [pois, setPois] = useState([]);
    const [marchingOrder, setMarchingOrder] = useState([]);
    const [partyPosition, setPartyPosition] = useState(null);
    const [weather, setWeather] = useState(null);
    const [travelInit, setTravelInit] = useState(null);
    const [travelSaveVersion, setTravelSaveVersion] = useState(0);
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);

    const isInitialized = useRef(false);
    const needsResetViewRef = useRef(false);
    // Name of the map whose BYTES this instance currently holds in state —
    // null until a load resolves, re-claimed on every load of a NEW name
    // (#801: it used to be seeded from the mount prop and never written
    // again, so an in-place mapName change opened the persistence guard's
    // stale side forever and saves silently died).
    const hexMapNameRef = useRef(null);
    const hexMapDisplayNameRef = useRef(mapName);
    const travelStateRef = useRef(null);
    // True when a LOADED map file carried a live trip (improve 2026-10-26-D):
    // lets useTravelToolSync distinguish the reopen/adoption resume from an
    // external (other-tab) travel start. Set only by the load path, never by
    // SSE echoes.
    const resumedTripRef = useRef(false);
    // Dirty baseline: last envelope known to be on the server (seeded at load,
    // claimed on every write). The persistence effect PUTs only when its
    // envelope differs from this.
    const lastSavedRef = useRef(null);
    // Coalescing autosave (improve 2026-10-26-D): one travel mutation lands
    // across TWO commits (partyPosition state + the publisher's
    // travelSaveVersion bump), which PUT the full document twice. The indoor
    // map lane (src/components/map/hooks/useMapLoader.js) already collapses
    // that churn with a 1s debounce + pending queue — copied verbatim here so
    // each real mutation flushes at most ONE PUT. Benign network/save debounce
    // (no-timers-guard category), never game state.
    const pendingSaveRef = useRef(null);
    const saveTimerRef = useRef(null);

    const setTravelStateRef = useCallback((ts) => {
        travelStateRef.current = ts;
        setTravelSaveVersion(prev => prev + 1);
    }, []);

    const clearSaveTimer = () => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    };

    // Sole save chokepoint (mirrors the indoor lane): the debounce flush, the
    // map-switch flush and the unmount flush all route through here. Writes
    // the name captured at QUEUE time under the bytes held at FLUSH time —
    // the cross-map guard lives in the queue step below.
    const flushSave = useCallback(() => {
        clearSaveTimer();
        const pending = pendingSaveRef.current;
        if (!pending) return;
        pendingSaveRef.current = null;
        lastSavedRef.current = pending.dataToSave;
        mapsService.saveMapData(pending.campaignName, pending.mapName, pending.dataToSave)
            .catch(err => console.error('Failed to save hex map data:', err));
    }, []);

    useEffect(() => {
        // Reload whenever the live mapName differs from the name whose bytes
        // we hold (#801). isInitialized alone never re-armed, so an in-place
        // mapName change left the old map's bytes on screen AND dead-closed
        // the persistence guard (:201). A characters-identity change while a
        // load is still in flight re-fires the GET for the same name — the
        // loadMapData transport is idempotent, so this is benign.
        if (isInitialized.current && hexMapNameRef.current === mapName) return;
        isInitialized.current = true;
        setLoading(true);

        const ctx = {
            setMapData, setGridSize, setTerrain, setRivers, setRoads, setPois,
            setZoom, setPanX, setPanY, setWeather, setTravelInit,
            setMarchingOrder, setPartyPosition, setLoading,
            hexMapDisplayNameRef, needsResetViewRef, hexMapNameRef,
            travelStateRef, lastSavedRef, resumedTripRef,
        };

        const loadMap = async () => {
            try {
                const existing = await mapsService.loadMapData(campaignName, mapName);
                if (existing) {
                    applyExistingMap(existing, mapName, characters, ctx);
                    return;
                }
            } catch (err) {
                // No-silent-fallback law (fix#337S #798): fall through to empty-map
                // creation, but LOUD — swallowed load errors were invisible before.
                console.error('Failed to load hex map data (falling through to fresh map):', err);
            }

            await createAndSaveNewMap(campaignName, mapName, characters, ctx);
        };

        loadMap();
    }, [campaignName, mapName, characters]);

    // Persistence effect. The guards are: `loading` STATE (skip pre-load —
    // flushing there would clobber server data with empty defaults), the
    // mapName-vs-held-bytes check below, and the DIRTY gate: the envelope is
    // deep-compared against the last document known to be on the server
    // (seeded from the normalized load snapshot), so a zero-edit open — and
    // the echo of this tab's own write — never re-PUTs the whole document
    // (backlog 2026-10-26: this lane emitted six no-op PUTs per open+back).
    // The ref guard is CROSS-MAP prevention, not de-dup: the save addresses
    // the LIVE mapName, so it may only fire while that live name is the name
    // whose bytes are in state.
    // On an in-place A→B switch it therefore skips (A's bytes must never be
    // written to B's URL), the load effect reloads B with `loading` back
    // true, and the load-completion batch re-claims hexMapNameRef.current,
    // re-seeds the baseline, and re-runs this effect exactly once with B's
    // snapshot (#800 determinism, #801 stale-ref death). `loading` stays in
    // the deps so the flush cannot miss; a ref flipped after an await seam
    // (old hasLoaded.current) left flush-vs-passive-effect ordering to the
    // scheduler — mount snapshot flushed once-or-not-at-all (#800).
    useEffect(() => {
        if (loading) return;
        if (mapName !== hexMapNameRef.current) return;

        const dataToSave = buildHexEnvelope({
            displayName: hexMapDisplayNameRef.current,
            gridSize,
            terrain,
            rivers,
            roads,
            pois,
            zoom,
            panX,
            panY,
            marchingOrder,
            partyPosition,
            weather,
            travelState: travelStateRef.current,
        });
        const queued = pendingSaveRef.current;
        if (queued && queued.mapName === mapName && queued.campaignName === campaignName
            && isEqual(queued.dataToSave, dataToSave)) {
            return; // identical document already scheduled (e.g. mid-debounce
                    // re-render) — let the single pending flush cover it
        }
        if (isEqual(dataToSave, lastSavedRef.current)) {
            // Zero-edit state churn (fresh load, echo, byte-identical publish):
            // nothing is dirtied against the server — drop any stale queue.
            pendingSaveRef.current = null;
            clearSaveTimer();
            return;
        }
        pendingSaveRef.current = { campaignName, mapName, dataToSave };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushSave, HEX_AUTOSAVE_DEBOUNCE_MS);
    }, [campaignName, mapName, loading, terrain, rivers, roads, pois, gridSize, zoom, panX, panY, marchingOrder, partyPosition, weather, travelSaveVersion, flushSave]);

    // Unmount / dep-change flush: a mutation inside the debounce window (GM
    // advances then immediately leaves the map) still lands — indoor lane's
    // chokepoint contract, copied. No timers advance GAME state; the POSTed
    // data already lives in the runtime store + change-data.
    useEffect(() => flushSave, [flushSave]);

    return {
        loading, mapData, setMapData,
        gridSize, setGridSize,
        terrain, setTerrain,
        rivers, setRivers,
        roads, setRoads,
        pois, setPois,
        marchingOrder, setMarchingOrder,
        partyPosition, setPartyPosition,
        weather, setWeather,
        travelInit, setTravelInit,
        travelSaveVersion,
        travelStateRef, setTravelStateRef,
        resumedTripRef,
        zoom, setZoom,
        panX, setPanX,
        panY, setPanY,
        needsResetViewRef,
        hexMapNameRef,
        hexMapDisplayNameRef,
    };
}

export default useMapLoader;
