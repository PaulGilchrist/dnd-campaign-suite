// @maintained-by-ai
/**
 * Lane: hex map loader — cross-shape save guard on the hex→indoor POI-entry
 * switch (bug 2026-10-30).
 *
 * Live fingerprint: entering a POI's linked INDOOR map while the hex editor
 * still held a dirty OUTDOOR document. The load effect re-armed for the
 * indoor map, applyExistingMap re-claimed hexMapNameRef (so the name guard
 * legitimately passed), and HexMap's view-normalize layout effect (stale
 * needsResetViewRef → zoom/pan rewrite) then dirtied the just-seeded baseline
 * — queueing a players-less outdoor envelope under the INDOOR URL. The server
 * players guard 400'd it (data safe, guaranteed console trio per entry).
 *
 * Contract locked here: while the loaded document is not type 'outdoor', the
 * persistence effect queues NOTHING; an outdoor document queued BEFORE the
 * switch still flushes to its OWN URL (debounce flush and unmount flush).
 *
 * Conventions mirror src/components/map/hooks/useMapLoader.test.js (fake
 * timers, mapsService spies, flush semantics of the 1s autosave debounce).
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';

const CAMPAIGN = 'test-campaign';
const OUTDOOR = 'qa-hex-fix';
const INDOOR = 'battle-arena';
const CHARACTERS = [{ name: 'Thorin', class: 'Fighter' }];

// Non-zero pan ⇒ not the old-default view: a quiet outdoor open performs no
// view normalization itself (mirrors the live rig map).
const OUTDOOR_DOC = {
    type: 'outdoor',
    displayName: 'QA Hex Fix',
    gridSize: 30,
    terrain: { '30,15': 'plains' },
    rivers: [],
    roads: [],
    pois: [{ id: 'poi-arena', type: 'dungeon', q: 31, r: 15, visible: true, linkedMap: 'battle-arena.json' }],
    zoom: 2,
    panX: -100,
    panY: -50,
    marchingOrder: ['Thorin'],
    partyPosition: { q: 30, r: 15 },
};

// Indoor document as stored: zero pan (isOldDefault → the component's
// needsResetView lane fires after adoption) and a players array the outdoor
// envelope builder can never carry.
const INDOOR_DOC = {
    type: 'indoor',
    displayName: 'Battle Arena',
    gridSize: 20,
    walls: [],
    placedItems: [],
    items: [],
    players: [{ name: 'Thorin' }],
    revealed: [],
    terrain: {},
    pois: [],
    zoom: 2,
    panX: 0,
    panY: 0,
};

describe('hex useMapLoader — hex→indoor POI-entry switch (mis-targeted save guard)', () => {
    let loadMapDataSpy;
    let saveMapDataSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        loadMapDataSpy = vi.spyOn(mapsService, 'loadMapData').mockResolvedValue(OUTDOOR_DOC);
        saveMapDataSpy = vi.spyOn(mapsService, 'saveMapData').mockResolvedValue({});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const renderHexLoader = (mapName = OUTDOOR) =>
        renderHook(
            (props) => useMapLoader(props.campaignName, props.mapName, CHARACTERS),
            { initialProps: { campaignName: CAMPAIGN, mapName } },
        );

    // Settle an in-flight load (microtasks only — no debounce advance).
    const settleLoad = async () => {
        await act(async () => {});
    };

    // HexMap's post-adoption view normalization (needsResetViewRef →
    // centerView(2)): exactly the churn that dirtied the baseline pre-fix.
    const normalizeView = (result) => {
        act(() => {
            result.current.setZoom(2);
            result.current.setPanX(617.04);
            result.current.setPanY(198.75);
        });
    };

    const enterIndoor = async ({ result, rerender }) => {
        loadMapDataSpy.mockResolvedValue(INDOOR_DOC);
        rerender({ campaignName: CAMPAIGN, mapName: INDOOR });
        await settleLoad();
        normalizeView(result);
    };

    const savesTo = (mapName) =>
        saveMapDataSpy.mock.calls.filter(([, name]) => name === mapName);

    it('a dirty outdoor document queued before the switch flushes to its OWN URL and is never PUT to the indoor map', async () => {
        const { result, rerender } = renderHexLoader();
        await settleLoad();
        expect(loadMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, OUTDOOR);

        // Real outdoor edit (POI Hide): queues under the outdoor name, inside
        // the 1s debounce window…
        act(() => result.current.setPois(OUTDOOR_DOC.pois.map((p) => ({ ...p, visible: false }))));

        // …then the GM enters the linked indoor map before the debounce fires.
        await enterIndoor({ result, rerender });

        await act(async () => { vi.advanceTimersByTime(1500); });

        // Exactly ONE save: the outdoor edit under the outdoor name, carrying
        // the outdoor bytes — zero traffic addressed to the indoor URL.
        expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
        expect(savesTo(INDOOR)).toHaveLength(0);
        expect(savesTo(OUTDOOR)).toHaveLength(1);
        const [, , payload] = saveMapDataSpy.mock.calls[0];
        expect(payload.type).toBe('outdoor');
        expect(payload.pois[0].visible).toBe(false);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('a zero-edit indoor entry writes NOTHING even after the post-adoption view normalization churns', async () => {
        const { result, rerender } = renderHexLoader();
        await settleLoad();

        await enterIndoor({ result, rerender });
        await act(async () => { vi.advanceTimersByTime(3000); });

        expect(saveMapDataSpy).not.toHaveBeenCalled();
    });

    it('the unmount flush still lands the pre-switch outdoor edit under the old captured name', async () => {
        const { result, rerender, unmount } = renderHexLoader();
        await settleLoad();

        act(() => result.current.setPois(OUTDOOR_DOC.pois.map((p) => ({ ...p, visible: false }))));
        await enterIndoor({ result, rerender });

        // HexMap unmounts (indoor editor takes over) before the debounce elapses.
        unmount();

        expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
        expect(saveMapDataSpy).toHaveBeenCalledWith(
            CAMPAIGN,
            OUTDOOR,
            expect.objectContaining({ type: 'outdoor' }),
        );
        expect(savesTo(INDOOR)).toHaveLength(0);
    });

    it('normal same-map persistence is unaffected: an outdoor edit still autosaves to its own URL', async () => {
        const { result } = renderHexLoader();
        await settleLoad();

        act(() => result.current.setPois(OUTDOOR_DOC.pois.map((p) => ({ ...p, label: 'Arena Gate' }))));
        await act(async () => { vi.advanceTimersByTime(1000); });

        expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
        expect(saveMapDataSpy).toHaveBeenCalledWith(
            CAMPAIGN,
            OUTDOOR,
            expect.objectContaining({ type: 'outdoor' }),
        );
        expect(saveMapDataSpy.mock.calls[0][2].pois[0].label).toBe('Arena Gate');
    });
});
