// @maintained-by-ai 2026-11-22
// ─── Lane: PlayerContextMenu — Light cycle row (PC-token light lane) ──────────
// The PC row MIRRORS the creature-side Light row in ItemContextMenu.jsx:
//   • label bytes `Light: <setting>`, absent = canonical bright default
//     (the same normalizeLightSetting the creature row reads);
//   • cycle order bright → dim → none → bright through the ONE LIGHT_CYCLE
//     table in hooks/usePlacedItems.js (no parallel implementation);
//   • the press keeps the menu open and the label re-reads the stored row
//     through the players[] lookup (mirror of the placedItems lookup).
// OWNED here: row presence/label census, the full live cycle through the REAL
// usePlacedItems handler, and the write payload — the exact players[] bytes
// handed to setMapData (the map-doc autosave PUT lane 'Remove from Map' rides).
// Dispatch of Remove/✕ stays in PlayerContextMenu.test.jsx; veil math is
// services/maps/lighting.test.js.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState, useRef } from 'react';
import PlayerContextMenu from './PlayerContextMenu';
import usePlacedItems from './hooks/usePlacedItems.js';

const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;

const PLAYER = { id: 'feyranger', name: 'FeyRanger', gridX: 1, gridY: 2 };
const OTHER = { id: 'aberrantsorcerer', name: 'AberrantSorcerer', gridX: 5, gridY: 5 };

const menuLabels = (container) =>
    Array.from(container.querySelectorAll('text')).map(t => t.textContent);

// ── Row presence + label (static renders) ──────────────────────

const renderMenu = (player, overrides = {}) => render(
    <PlayerContextMenu
        selectedPlayer={player}
        players={[player, OTHER]}
        gridCenterX={gridCenterX}
        gridCenterY={gridCenterY}
        handleRemovePlayer={vi.fn()}
        handleCyclePlayerLight={vi.fn()}
        setSelectedPlayer={vi.fn()}
        {...overrides}
    />
);

describe('Light row label mirrors the creature-side row', () => {
    it.each([
        ['absent = bright default', { ...PLAYER }, 'Light: bright'],
        ['stored dim', { ...PLAYER, light: 'dim' }, 'Light: dim'],
        ['stored none', { ...PLAYER, light: 'none' }, 'Light: none'],
        ['stored bright', { ...PLAYER, light: 'bright' }, 'Light: bright'],
    ])('%s → %s', (_label, player, expected) => {
        const { container } = renderMenu(player);
        expect(screen.getByText(expected)).toBeInTheDocument();
        // Exact ordered census: Remove row, Light row, close glyph.
        expect(menuLabels(container)).toEqual(['Remove from Map', expected, '✕']);
    });

    it('the row is never gated on the stored shape — every PC menu carries it', () => {
        const { container } = renderMenu({ id: 'bare', gridX: 0, gridY: 0 });
        expect(screen.getByText('Light: bright')).toBeInTheDocument();
        expect(menuLabels(container)).toEqual(['Remove from Map', 'Light: bright', '✕']);
    });
});

// ── Live cycle through the REAL hook + write payload ───────────

// Harness: PlayerContextMenu fed by the same usePlacedItems seam Map.jsx wires
// (setPlacedItems/setSelectedItem inert here — this lane never touches the
// placedItems array). setMapData is REAL state, so every press re-renders the
// label from the stored row exactly like the live map doc does.
function CycleHarness({ onWrite }) {
    const [doc, setDoc] = useState({ players: [{ ...PLAYER }, { ...OTHER }] });
    const writes = useRef([]);
    const setMapData = (fn) => {
        writes.current.push(fn);
        onWrite(fn);
        setDoc(fn);
    };
    const { handleCyclePlayerLight } = usePlacedItems(vi.fn(), vi.fn(), [], setMapData);
    return (
        <svg>
            <PlayerContextMenu
                selectedPlayer={PLAYER}
                players={doc.players}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                handleRemovePlayer={vi.fn()}
                handleCyclePlayerLight={handleCyclePlayerLight}
                setSelectedPlayer={vi.fn()}
            />
        </svg>
    );
}

describe('full cycle bright → dim → none → bright', () => {
    it('relives the door-toggle idiom with live labels and exact players[] payloads', () => {
        const writeFns = [];
        render(<CycleHarness onWrite={(fn) => writeFns.push(fn)} />);

        const doc = ({ players: [{ ...PLAYER }, { ...OTHER }] });
        const seen = [];
        for (let press = 0; press < 3; press++) {
            fireEvent.click(screen.getByText(/^Light: /));
            doc.players = writeFns[press](doc).players;
            seen.push({
                label: screen.getByText(/^Light: /).textContent,
                written: doc.players[0].light,
                otherUntouched: JSON.stringify(doc.players[1]),
            });
        }
        expect(seen.map(s => s.label)).toEqual(['Light: dim', 'Light: none', 'Light: bright']);
        // The press ALWAYS writes an explicit value — never the absent-key shape.
        expect(seen.map(s => s.written)).toEqual(['dim', 'none', 'bright']);
        // Payload is a row SPREAD: the sibling player is byte-untouched, and the
        // edited row keeps every original field alongside the new light.
        seen.forEach(s => expect(s.otherUntouched).toBe(JSON.stringify(OTHER)));
        expect(doc.players[0]).toEqual({ ...PLAYER, light: 'bright' });
    });

    it('the light press keeps the menu open and never dispatches removal', () => {
        const setSelectedPlayer = vi.fn();
        const handleRemovePlayer = vi.fn();
        const { container } = render(
            <PlayerContextMenu
                selectedPlayer={PLAYER}
                players={[{ ...PLAYER }, { ...OTHER }]}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                handleRemovePlayer={handleRemovePlayer}
                handleCyclePlayerLight={vi.fn()}
                setSelectedPlayer={setSelectedPlayer}
            />
        );
        fireEvent.click(screen.getByText('Light: bright'));
        expect(container.querySelector('.item-context-menu')).toBeInTheDocument();
        expect(setSelectedPlayer).not.toHaveBeenCalled();
        expect(handleRemovePlayer).not.toHaveBeenCalled();
    });

    it('dispatches the cycle with the selected player id', () => {
        const handleCyclePlayerLight = vi.fn();
        renderMenu(PLAYER, { handleCyclePlayerLight });
        fireEvent.click(screen.getByText('Light: bright'));
        expect(handleCyclePlayerLight).toHaveBeenCalledTimes(1);
        expect(handleCyclePlayerLight).toHaveBeenCalledWith('feyranger');
    });
});
