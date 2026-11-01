// @maintained-by-ai
// ─── Lane: spell-overlay destructive dialog mount in Map.jsx ─────────────────
// Backlog 2026-11-01 BA: the overlay Remove / Clear All lanes no longer pay a
// native confirm — useSpellOverlay stages a pendingOverlayAction descriptor
// and Map.jsx mounts it through SpellOverlayConfirmModal over the shared
// DeleteConfirmModal role=dialog tier (sibling of the DeleteFromMapModal the
// token/prop/player/POI lanes ride). Copied here: the mount contract (null
// when idle, both kind faces when armed) and the Cancel/Yes button routing
// back to the hook's cancel/confirm staging. Descriptor semantics live in
// hooks/useSpellOverlay.test.js; copy bytes live in
// SpellOverlayConfirmModal.test.jsx; indoor POI dialog tier in
// Map.indoor-pois.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
    createMap: vi.fn(() => Promise.resolve({ name: 'test', alreadyExists: false })),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
    updateMapDescription: vi.fn(),
    formatMapName: vi.fn((name) => name),
}));

vi.mock('../common/Subscriber.jsx', () => ({ default: () => null }));
vi.mock('../hex-map/HexMap.jsx', () => ({ default: () => <div data-testid="hex-map" /> }));
vi.mock('./Map3D/Map3D.jsx', () => ({ default: () => <div data-testid="map3d" /> }));
vi.mock('../encounter/MonsterCardModal.jsx', () => ({ default: () => <div data-testid="monster-card-modal" /> }));

// Controllable hook double: Map.jsx consumes the staging trio verbatim, so
// mutating `overlayState` + rerendering exercises the real mount wiring.
let overlayState;
vi.mock('./hooks/useSpellOverlay.js', () => ({
    default: () => overlayState,
}));

import * as mapsService from '../../services/maps/mapsService.js';
import Map from './Map.jsx';

function defaultOverlayState(overrides = {}) {
    return {
        overlays: [],
        addOverlay: vi.fn(),
        updateOverlay: vi.fn(),
        updateOverlayImmediate: vi.fn(),
        removeOverlay: vi.fn(),
        clearOverlays: vi.fn(),
        pendingOverlayAction: null,
        cancelOverlayAction: vi.fn(),
        confirmOverlayAction: vi.fn(),
        handleSSEEvent: vi.fn(),
        ...overrides,
    };
}

const renderMap = () => render(
    <Map
        campaignName="test-campaign"
        characters={[]}
        isLocalhost
        mapName="test-map"
        onBack={vi.fn()}
        onEncounterCreated={vi.fn()}
        onPoiEntered={vi.fn()}
    />
);

describe('spell-overlay confirm dialog mount (Map.jsx)', () => {
    let confirmSpy;

    beforeEach(async () => {
        vi.clearAllMocks();
        confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        mapsService.loadMapData.mockResolvedValue({
            type: 'indoor',
            displayName: 'Test Map',
            gridSize: 20,
            players: [],
            walls: [],
            placedItems: [],
            pois: [],
        });
        overlayState = defaultOverlayState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders no dialog while idle and none for the map lanes either', async () => {
        renderMap();
        await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('arms the Remove Overlay dialog tier for a remove descriptor and routes Yes, Remove/Cancel to the hook', async () => {
        overlayState = defaultOverlayState({
            pendingOverlayAction: { kind: 'remove', label: 'Sphere', confirm: vi.fn() },
        });
        const { rerender } = renderMap();
        await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());
        // Arming AFTER mount surfaces the dialog on the next commit (the
        // §244-style dispatch/flush split at the React level).
        overlayState = { ...overlayState, pendingOverlayAction: { kind: 'remove', label: 'Sphere', confirm: vi.fn() } };
        rerender(
            <Map campaignName="test-campaign" characters={[]} isLocalhost mapName="test-map"
                onBack={vi.fn()} onEncounterCreated={vi.fn()} onPoiEntered={vi.fn()} />
        );

        const dialog = screen.getByRole('dialog', { name: 'Remove Overlay' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveTextContent('Remove this Sphere overlay?');
        expect(confirmSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Yes, Remove' }));
        expect(overlayState.confirmOverlayAction).toHaveBeenCalledTimes(1);
        expect(overlayState.cancelOverlayAction).not.toHaveBeenCalled();
    });

    it('arms the Clear All Overlays dialog tier naming the count + everyone scope, routing to the hook', async () => {
        overlayState = defaultOverlayState({
            pendingOverlayAction: { kind: 'clear', count: 2, confirm: vi.fn() },
        });
        renderMap();
        await waitFor(() => expect(document.querySelector('svg.grid-svg')).toBeTruthy());

        const dialog = screen.getByRole('dialog', { name: 'Clear All Overlays' });
        expect(dialog).toHaveTextContent(
            'Clear all 2 spell overlays? This removes overlays placed by everyone.'
        );
        expect(confirmSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(overlayState.cancelOverlayAction).toHaveBeenCalledTimes(1);
        expect(overlayState.confirmOverlayAction).not.toHaveBeenCalled();
    });
});
