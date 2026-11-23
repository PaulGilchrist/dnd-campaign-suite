// @maintained-by-ai: 2026-11-23
// ─── Lane: Players — visitor-origin context-menu gate ─────────────────────────
// bug-visitor-map-token-menu-phantom-authoring: a LAN-visitor tab could
// right-click ANY player token and get the full authoring PlayerContextMenu
// (Remove from Map / Light cycle). Every press applied a LOCAL-only edit —
// useMapLoader's flushSave early-returns for non-localhost, so zero requests
// ever fired and the phantom survived until an unrelated SSE echo rolled it
// back. The fix mirrors the sibling placed-item lanes (PlacedItems.jsx
// `{isLocalhost && dragChrome}` + creature hit areas; IndoorPoiLayer.jsx
// `{isLocalhost && ...}`): the context-menu OPENER is GM-only, so a visitor
// token circle carries no onContextMenu handler at all. A visitor right-click
// then bubbles to the svg root's preventDefault — no browser menu, no
// phantom authoring menu.
//
//   token render geometry / fog / drag classes          → Players.test.jsx
//   menu content + Remove/✕ dispatch                    → PlayerContextMenu.test.jsx
//   light row label + cycle dispatch                    → PlayerContextMenu.light.test.jsx
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Players from './Players.jsx';

const gridCenterX = (gx) => gx * 50 + 25;
const gridCenterY = (gy) => gy * 50 + 25;

const PLAYER = { id: 'player-1', name: 'Thorin', gridX: 2, gridY: 3 };

const renderComponent = (props = {}, players = [PLAYER]) =>
    render(
        <svg width={1200} height={800}>
            <Players
                players={players}
                characters={[]}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                campaignName="test-campaign"
                handlePointerDown={vi.fn()}
                setSelectedPlayer={vi.fn()}
                {...props}
            />
        </svg>
    );

const dispatchContext = (container) =>
    container.querySelector('circle.creature-circle')
        .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

describe('Players visitor context-menu gate', () => {
    it('GM (localhost) token circle opens the authoring menu via setSelectedPlayer', () => {
        const setSelectedPlayer = vi.fn();
        const { container } = renderComponent({ isLocalhost: true, setSelectedPlayer });
        dispatchContext(container);
        expect(setSelectedPlayer).toHaveBeenCalledWith(PLAYER);
    });

    it('visitor-origin tab fires NO context-menu opener — no phantom authoring', () => {
        const setSelectedPlayer = vi.fn();
        const { container } = renderComponent({ isLocalhost: false, setSelectedPlayer });
        // The token itself stays rendered (visitors see the board); only the
        // authoring opener is gone.
        expect(container.querySelectorAll('g.creature-group').length).toBe(1);
        dispatchContext(container);
        expect(setSelectedPlayer).not.toHaveBeenCalled();
    });

    it('visitor-owned token (local sidebar selection ring) is also opener-less', () => {
        const setSelectedPlayer = vi.fn();
        const { container } = renderComponent({
            isLocalhost: false,
            localCharacterName: 'Thorin',
            setSelectedPlayer,
        });
        // Ownership ring still paints (read-only chrome, unchanged doctrine)
        expect(container.querySelector('.owned-token-ring')).toBeInTheDocument();
        dispatchContext(container);
        expect(setSelectedPlayer).not.toHaveBeenCalled();
    });
});
