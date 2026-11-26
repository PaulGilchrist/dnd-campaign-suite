// @maintained-by-ai
// ─── Lane: Players — Item 5 token cosmetics on the indoor 2D face ─────────────
// OWNED here: the render consumption of the canonical character-bucket row
// (config/tokenCosmetics.js) — personal RING COLOR applied via the palette
// CSS class on the disc (never an inline style), LABEL visibility (hideLabel
// removes the .creature-name element), the UNSET default keeping the token
// bytes today's shape, live SSE-echo adoption (replaceRuntimeObject is the
// exact mirror App.jsx applyStoreUpdate runs for `change-<campaign>-<name>`),
// and the visitor opener law (own token opens the menu, foreign tokens stay
// opener-less — the menu's own section gating is PlayerContextMenu's lane).
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Players from './Players.jsx';
import { getStore, notify, replaceRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';
import { TOKEN_COSMETICS_KEY } from '../../config/tokenCosmetics.js';

const CAMPAIGN = 'test-campaign';
const gridCenterX = (gx) => gx * 50 + 25;
const gridCenterY = (gy) => gy * 50 + 25;

const PLAYER = { id: 'player-1', name: 'Thorin', gridX: 2, gridY: 3 };
const FOREIGN = { id: 'player-2', name: 'Gimli', gridX: 4, gridY: 4 };

const renderPlayers = (props = {}, players = [PLAYER]) =>
    render(
        <svg width={1200} height={800}>
            <Players
                players={players}
                characters={[]}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                isLocalhost
                campaignName={CAMPAIGN}
                handlePointerDown={vi.fn()}
                setSelectedPlayer={vi.fn()}
                {...props}
            />
        </svg>
    );

const seedCosmetics = (name, row) => {
    act(() => {
        getStore(name).set(TOKEN_COSMETICS_KEY, row);
        notify(name);
    });
};

const disc = (container, index = 0) =>
    container.querySelectorAll('circle.creature-circle')[index];

describe('Players — ring color from the palette class', () => {
    beforeEach(() => {
        getStore('Thorin').clear();
        getStore('Gimli').clear();
    });

    it('unset carries no token-ring class and keeps the label (default face)', () => {
        const { container } = renderPlayers();
        expect(disc(container).className.baseVal).not.toContain('token-ring-');
        expect(container.querySelector('text.creature-name')).toBeInTheDocument();
    });

    it('applies the palette CSS class (no inline style) for a stored ring id', () => {
        seedCosmetics('Thorin', { ringColor: 'ember', hideLabel: false });
        const { container } = renderPlayers();
        expect(disc(container)).toHaveClass('token-ring-ember');
        expect(disc(container)).not.toHaveAttribute('style');
    });

    it('an off-palette stored id renders no ring class (normalize, not a second law)', () => {
        seedCosmetics('Thorin', { ringColor: 'neon', hideLabel: false });
        const { container } = renderPlayers();
        expect(disc(container).className.baseVal).not.toContain('token-ring-');
    });

    it('live echo adoption: replaceRuntimeObject (the SSE lane) repaints the open board', () => {
        const { container } = renderPlayers();
        expect(disc(container)).not.toHaveClass('token-ring-leaf');
        act(() => replaceRuntimeObject('Thorin',
            { [TOKEN_COSMETICS_KEY]: { ringColor: 'leaf', hideLabel: true } }, CAMPAIGN, true));
        expect(disc(container)).toHaveClass('token-ring-leaf');
        expect(container.querySelector('text.creature-name')).toBeNull();
    });
});

describe('Players — label visibility', () => {
    beforeEach(() => {
        getStore('Thorin').clear();
    });

    it('hideLabel true removes the name element (portrait face keeps art)', () => {
        seedCosmetics('Thorin', { ringColor: null, hideLabel: true });
        const { container } = renderPlayers();
        expect(container.querySelector('text.creature-name')).toBeNull();
        expect(container.querySelector('text.creature-initial')).toBeInTheDocument();
    });

    it('hideLabel false (or garbage) keeps the label', () => {
        for (const hideLabel of [false, 'no']) {
            seedCosmetics('Thorin', { hideLabel });
            const { container, unmount } = renderPlayers();
            expect(container.querySelector('text.creature-name')).toBeInTheDocument();
            unmount();
        }
    });
});

describe('Players — visitor opener gate for the cosmetics menu', () => {
    beforeEach(() => {
        getStore('Thorin').clear();
        getStore('Gimli').clear();
    });

    const rightClick = (container, index) =>
        disc(container, index).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

    it('a visitor opening THEIR OWN token arms the menu selection', () => {
        const setSelectedPlayer = vi.fn();
        const { container } = renderPlayers(
            { isLocalhost: false, localCharacterName: 'Thorin', setSelectedPlayer },
            [PLAYER, FOREIGN],
        );
        rightClick(container, 0);
        expect(setSelectedPlayer).toHaveBeenCalledWith(PLAYER);
    });

    it('a visitor right-clicking a FOREIGN token stays opener-less (honest read-only)', () => {
        const setSelectedPlayer = vi.fn();
        const { container } = renderPlayers(
            { isLocalhost: false, localCharacterName: 'Thorin', setSelectedPlayer },
            [FOREIGN],
        );
        rightClick(container, 0);
        expect(setSelectedPlayer).not.toHaveBeenCalled();
    });

    it('a visitor with no sidebar identity gets no opener on any token', () => {
        const setSelectedPlayer = vi.fn();
        const { container } = renderPlayers(
            { isLocalhost: false, localCharacterName: undefined, setSelectedPlayer },
        );
        rightClick(container, 0);
        expect(setSelectedPlayer).not.toHaveBeenCalled();
    });

    it('fogged tokens stay invisible to visitors even when owned', () => {
        const { container } = renderPlayers(
            { isLocalhost: false, localCharacterName: 'Thorin', fog: new Set(['2,3']) },
        );
        expect(container.querySelectorAll('g.creature-group')).toHaveLength(0);
    });
});
