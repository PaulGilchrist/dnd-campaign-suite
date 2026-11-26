// @maintained-by-ai 2026-11-25
// ─── Lane: PlayerContextMenu — Item 5 cosmetics section ───────────────────────
// OWNED here: the ownership/origin GATING of the menu's cosmetics section
// (GM any token: author rows + cosmetics; visitor own-token: cosmetics only,
// authoring rows absent — those write the GM-only map doc and must never
// appear on a visitor tab, bug-visitor-map-token-menu-phantom-authoring;
// visitor misdirect: nothing renders), the campaignName requirement (writes
// need the runtime lane — without it the legacy authoring-only face renders,
// the shape the pre-Item-5 PlayerContextMenu tests pin), the canonical ROW
// written to the character bucket (always the full { ringColor, hideLabel }
// shape; active-swatch press clears to null; label toggles), and the
// keyboard lane (Enter/Space activation, Escape dismiss-zero-write).
// The Remove/Light/✕ dispatch contract stays in PlayerContextMenu.test.jsx
// and PlayerContextMenu.light.test.jsx (unmodified — no campaignName ⇒ the
// authoring-only census renders byte-identically).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerContextMenu from './PlayerContextMenu';
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import { TOKEN_COSMETICS_KEY, TOKEN_PALETTE } from '../../config/tokenCosmetics.js';

const CAMPAIGN = 'test-campaign';
const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;

const OWN = { id: 'p1', name: 'Thorin', gridX: 1, gridY: 2 };
const FOREIGN = { id: 'p2', name: 'Gimli', gridX: 5, gridY: 5 };

const renderMenu = (props = {}) => render(
    <svg>
        <PlayerContextMenu
            selectedPlayer={OWN}
            players={[OWN, FOREIGN]}
            gridCenterX={gridCenterX}
            gridCenterY={gridCenterY}
            handleRemovePlayer={vi.fn()}
            handleCyclePlayerLight={vi.fn()}
            setSelectedPlayer={vi.fn()}
            campaignName={CAMPAIGN}
            {...props}
        />
    </svg>
);

const swatchFor = (label) => screen.getByRole('menuitem', { name: `Ring colour: ${label}` });

describe('section gating', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
        getStore('Thorin').clear();
    });
    afterEach(() => { vi.unstubAllGlobals(); getStore('Thorin').clear(); });

    it('GM sees the author rows AND the cosmetics controls for any token', () => {
        renderMenu({ isLocalhost: true, players: [FOREIGN], selectedPlayer: FOREIGN });
        expect(screen.getByText('Remove from Map')).toBeInTheDocument();
        expect(screen.getByText('Light: bright')).toBeInTheDocument();
        expect(swatchFor('Ember')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Label: shown' })).toBeInTheDocument();
    });

    it('visitor own token: cosmetics only — no Remove, no Light (no phantom authoring)', () => {
        renderMenu({ isLocalhost: false, localCharacterName: 'Thorin' });
        expect(swatchFor('Default (clear)')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Label: shown' })).toBeInTheDocument();
        expect(screen.queryByText('Remove from Map')).toBeNull();
        expect(screen.queryByText(/^Light: /)).toBeNull();
    });

    it('visitor foreign token misdirected straight at the menu renders nothing', () => {
        const { container } = renderMenu({ isLocalhost: false, localCharacterName: 'Thorin', selectedPlayer: FOREIGN, players: [FOREIGN] });
        expect(container.querySelector('.item-context-menu')).toBeNull();
    });

    it('no campaignName keeps the legacy authoring-only face (runtime lane unavailable)', () => {
        const { container } = renderMenu({ campaignName: undefined });
        expect(screen.getByText('Remove from Map')).toBeInTheDocument();
        expect(screen.queryByText(/^Label: /)).toBeNull();
        expect(container.querySelectorAll('[aria-label^="Ring colour"]').length).toBe(0);
    });
});

describe('canonical row writes to the character bucket', () => {
    let fetchMock;
    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
        vi.stubGlobal('fetch', fetchMock);
        getStore('Thorin').clear();
    });
    afterEach(() => { vi.unstubAllGlobals(); getStore('Thorin').clear(); });

    const readRow = () => getStore('Thorin').get(TOKEN_COSMETICS_KEY);

    it('pressing a swatch writes the full canonical row { ringColor, hideLabel }', () => {
        renderMenu({ isLocalhost: true });
        fireEvent.click(swatchFor('Ember'));
        expect(readRow()).toEqual({ ringColor: 'ember', hideLabel: false });
        // The write rides the character runtime lane (one POST to the bucket).
        expect(fetchMock).toHaveBeenCalledWith(
            `/api/campaigns/${CAMPAIGN}/Thorin`,
            expect.objectContaining({ method: 'POST' }),
        );
        // The pressed swatch now reads active, and the Label row stayed honest.
        expect(swatchFor('Ember (selected — press to clear)')).toBeInTheDocument();
    });

    it('pressing the ACTIVE swatch clears back to null (one way home)', () => {
        getStore('Thorin').set(TOKEN_COSMETICS_KEY, { ringColor: 'violet', hideLabel: false });
        renderMenu({ isLocalhost: true });
        fireEvent.click(swatchFor('Violet (selected — press to clear)'));
        expect(readRow()).toEqual({ ringColor: null, hideLabel: false });
    });

    it('the Default swatch clears a stored ring', () => {
        getStore('Thorin').set(TOKEN_COSMETICS_KEY, { ringColor: 'gold', hideLabel: false });
        renderMenu({ isLocalhost: true });
        fireEvent.click(swatchFor('Default (clear)'));
        expect(readRow()).toEqual({ ringColor: null, hideLabel: false });
    });

    it('the Label row toggles and relabels in place, keeping the ring field', () => {
        getStore('Thorin').set(TOKEN_COSMETICS_KEY, { ringColor: 'leaf', hideLabel: false });
        renderMenu({ isLocalhost: true });
        // MenuOption puts the click handler on the <text> (the g wrapper owns
        // keyboard activation) — click the row's label, like a pointer does.
        fireEvent.click(screen.getByText('Label: shown'));
        expect(readRow()).toEqual({ ringColor: 'leaf', hideLabel: true });
        fireEvent.click(screen.getByText('Label: hidden'));
        expect(readRow()).toEqual({ ringColor: 'leaf', hideLabel: false });
    });

    it('every palette entry offers a swatch (single exported constant drives the row)', () => {
        renderMenu({ isLocalhost: true });
        for (const { label } of TOKEN_PALETTE) {
            expect(swatchFor(label)).toBeInTheDocument();
        }
    });
});

describe('keyboard lane', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
        getStore('Thorin').clear();
    });
    afterEach(() => { vi.unstubAllGlobals(); getStore('Thorin').clear(); });

    it('Enter on a focused swatch applies the ring color (same action as click)', () => {
        renderMenu({ isLocalhost: true });
        const swatch = swatchFor('Azure');
        swatch.focus();
        fireEvent.keyDown(swatch, { key: 'Enter' });
        expect(getStore('Thorin').get(TOKEN_COSMETICS_KEY)).toEqual({ ringColor: 'azure', hideLabel: false });
    });

    it('Space on the Label row toggles visibility (MenuOption contract)', () => {
        renderMenu({ isLocalhost: true });
        const row = screen.getByRole('menuitem', { name: 'Label: shown' });
        row.focus();
        fireEvent.keyDown(row, { key: ' ' });
        expect(getStore('Thorin').get(TOKEN_COSMETICS_KEY)).toEqual({ ringColor: null, hideLabel: true });
    });

    it('Escape dismisses via setSelectedPlayer(null) with zero writes', () => {
        const setSelectedPlayer = vi.fn();
        renderMenu({ isLocalhost: true, setSelectedPlayer });
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(setSelectedPlayer).toHaveBeenCalledWith(null);
        expect(getStore('Thorin').has(TOKEN_COSMETICS_KEY)).toBe(false);
    });
});
