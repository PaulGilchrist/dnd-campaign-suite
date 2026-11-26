import { useEffect, useRef } from 'react';
import MenuOption from '../common/MenuOption.jsx';
import { useMenuRoving } from '../../hooks/ui/useMenuRoving';
import { normalizeLightSetting } from '../../services/maps/lighting.js';
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import {
    TOKEN_COSMETICS_KEY,
    TOKEN_PALETTE,
    getTokenRingClass,
    normalizeTokenCosmetics,
} from '../../config/tokenCosmetics.js';
import { isTokenOwnedHere } from '../../services/maps/tokenOwnership.js';

const MENU_WIDTH = 120;
const SWATCH_START = 10;
const SWATCH_STEP = 12.5;
const SWATCH_RADIUS = 4.5;
const SWATCH_ACTIVE_RADIUS = 7;

const swatchX = (index) => SWATCH_START + index * SWATCH_STEP;

// Enter/Space activation wrapper for the swatch circles — the same contract
// MenuOption ships for text rows (the shared keyboard lane of the SVG menu
// family, backlog 2026-11-16 XC), because a <circle> is not a MenuOption.
function SwatchOption({ className, ariaLabel, title, onActivate, children }) {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onActivate();
        }
    };
    return (
        <g
            role="menuitem"
            tabIndex={0}
            className={className}
            aria-label={ariaLabel}
            onClick={onActivate}
            onKeyDown={handleKeyDown}
        >
            <title>{title}</title>
            {children}
        </g>
    );
}

/**
 * Per-token cosmetics section (learnability backlog Item 5): the fixed
 * palette swatch row + the label-visibility toggle for ONE character.
 *
 * WRITE LANE (see the field-home trace in config/tokenCosmetics.js): the
 * character runtime bucket `tokenCosmetics`, through useSyncedState — the
 * shared lane a visitor tab can genuinely write (the map-doc PUT this menu's
 * authoring rows ride is GM-only), and its `change-<campaign>-<name>` SSE
 * echo adopts tab-wide via App.jsx applyStoreUpdate with zero new plumbing.
 * Every press writes the FULL canonical row (normalize → patch), so the
 * stored shape is always { ringColor, hideLabel } — absent ⇒ defaults. The
 * press keeps the menu open (Light-row idiom: the row re-reads live truth
 * and the label/active ring update in place).
 */
function TokenCosmeticsControls({ playerName, campaignName, menuX, cosmeticsTop }) {
    const [stored, setStored] = useSyncedState(playerName, TOKEN_COSMETICS_KEY, null, campaignName);
    const cosmetics = normalizeTokenCosmetics(stored);

    const applyPatch = (patch) => {
        setStored((prev) => ({ ...normalizeTokenCosmetics(prev), ...patch }));
    };

    return (
        <>
            {/* Swatch row: default first, then the palette. Pressing the
              active swatch (or Default) clears back to the untouched disc —
              the ONLY way home, so no per-swatch "off" state exists. */}
            <SwatchOption
                className="token-ring-swatches"
                ariaLabel="Ring colour: Default (clear)"
                title="Ring colour: default (clear)"
                onActivate={() => applyPatch({ ringColor: null })}
            >
                {cosmetics.ringColor === null && (
                    <circle
                        cx={menuX + swatchX(0)}
                        cy={cosmeticsTop}
                        r={SWATCH_ACTIVE_RADIUS}
                        className="token-ring-swatch-active"
                    />
                )}
                <circle
                    cx={menuX + swatchX(0)}
                    cy={cosmeticsTop}
                    r={SWATCH_RADIUS}
                    className="token-ring-swatch token-ring-swatch-default"
                />
            </SwatchOption>
            {TOKEN_PALETTE.map((entry, i) => (
                <SwatchOption
                    key={entry.id}
                    className={`token-ring-swatches${getTokenRingClass(entry.id) ? ` ${getTokenRingClass(entry.id)}` : ''}`}
                    ariaLabel={`Ring colour: ${entry.label}${cosmetics.ringColor === entry.id ? ' (selected — press to clear)' : ''}`}
                    title={`Ring colour: ${entry.label}${cosmetics.ringColor === entry.id ? ' (selected — press to clear)' : ''}`}
                    onActivate={() => applyPatch({ ringColor: cosmetics.ringColor === entry.id ? null : entry.id })}
                >
                    {cosmetics.ringColor === entry.id && (
                        <circle
                            cx={menuX + swatchX(i + 1)}
                            cy={cosmeticsTop}
                            r={SWATCH_ACTIVE_RADIUS}
                            className="token-ring-swatch-active"
                        />
                    )}
                    <circle
                        cx={menuX + swatchX(i + 1)}
                        cy={cosmeticsTop}
                        r={SWATCH_RADIUS}
                        className={`token-ring-swatch ${getTokenRingClass(entry.id)}`}
                    />
                </SwatchOption>
            ))}
            {/* Label toggle row — the Light-row idiom: the label names the
              CURRENT stored setting (absent = today's shown default). */}
            <MenuOption
                x={menuX + 8}
                y={cosmeticsTop + 24}
                fill="#ccc"
                onActivate={() => applyPatch({ hideLabel: !cosmetics.hideLabel })}
            >
                {`Label: ${cosmetics.hideLabel ? 'hidden' : 'shown'}`}
            </MenuOption>
        </>
    );
}

// Menu permission/geometry model — hoisted pure helper (complexity ratchet).
// canAuthor: map-doc authoring rows (Remove/Light) are GM-only — flushSave
// drops those writes client-side and the server 403s them from a visitor, so
// offering them is the phantom-authoring bug family.
// canCosmetics: the character-bucket lane every origin can genuinely persist;
// a visitor may ride it ONLY for their own token (isTokenOwnedHere), and
// only with a campaignName (without one the runtime lane has no home and the
// legacy authoring-only face renders — the shape the pre-Item-5 tests pin).
// Row stacking: author rows keep their historical y offsets (+24/+46); the
// cosmetics block starts beneath them (GM) or at the top (visitor-only).
function menuModelFor({ player, campaignName, isLocalhost, localCharacterName, menuY }) {
    const canAuthor = isLocalhost;
    const canCosmetics = Boolean(player?.name) && Boolean(campaignName)
        && (isLocalhost || isTokenOwnedHere({ isLocalhost, localCharacterName, playerName: player.name }));
    const open = Boolean(player) && (canAuthor || canCosmetics);
    return {
        canAuthor,
        canCosmetics,
        open,
        menuHeight: canAuthor ? (canCosmetics ? 104 : 58) : (canCosmetics ? 62 : 0),
        cosmeticsTop: menuY + (canAuthor ? 72 : 26),
    };
}

// isLocalhost DEFAULTS TRUE: this menu was born a GM-only authoring surface
// (its opener historically mounted only on localhost), so an un-threaded
// render keeps its full authoring face. Map.jsx ALWAYS passes the real origin
// (players[] authoring rows are dropped for visitor opens of their own token
// — flushSave drops those writes client-side and the server 403s them).
function PlayerContextMenu({ selectedPlayer, players, gridCenterX, gridCenterY, handleRemovePlayer, handleCyclePlayerLight, setSelectedPlayer, campaignName, isLocalhost = true, localCharacterName }) {
    const menuRef = useRef(null);
    // selectedPlayer is the open-time snapshot; the Light label must name the
    // CURRENT stored setting, so the row re-reads the live players[] doc
    // (mirrors ItemContextMenu's placedItems lookup — every press relabels the
    // row in place while the menu stays open).
    const player = selectedPlayer
        ? (players || []).find(p => p.id === selectedPlayer.id) || selectedPlayer
        : null;
    const menuX = player ? gridCenterX(player.gridX) + 10 : 0;
    const menuY = player ? gridCenterY(player.gridY) + 10 : 0;
    const { canAuthor, canCosmetics, open, menuHeight, cosmeticsTop } =
        menuModelFor({ player, campaignName, isLocalhost, localCharacterName, menuY });
    // Keyboard kit (Item 5 menu rows must be reachable, audit Item-6 #4 law):
    // open-focus + Arrow/Home/End rove + close-restore ride the shared hook;
    // Enter/Space activation lives in MenuOption/SwatchOption.
    const handleMenuKeyDown = useMenuRoving(
        menuRef,
        open ? `${selectedPlayer.id}:${menuX}:${menuY}` : null,
        open,
    );

    // Escape = dismiss-zero-write (modal-family law of 3f41dc16b, mirroring
    // ItemContextMenu): routes to the plain close seam, never activating the
    // focused option.
    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            setSelectedPlayer(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, setSelectedPlayer]);

    if (!open) return null;

    return (
        <g
            className="item-context-menu"
            role="menu"
            ref={menuRef}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleMenuKeyDown}
        >
            <g>
                <rect x={menuX} y={menuY} width={MENU_WIDTH} height={menuHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                {canAuthor && (
                    <>
                        <MenuOption
                            x={menuX + 8}
                            y={menuY + 24}
                            fill="#ccc"
                            onActivate={() => {
                                // Removal no longer asks a native window.confirm: clicking
                                // hands off to handleRemovePlayer (Map.jsx), which stages the
                                // in-app named-confirm modal — `Remove "<name>" from the map?`
                                // through the shared DeleteConfirmModal (same role="dialog"
                                // tier as the MapsManager "Delete Map" dialog; backlog
                                // 2026-11-01 AZ2). Cancel there is fully inert — no
                                // setMapData write, the map's autosave PUT lane never
                                // fires. The menu closes here, as before.
                                handleRemovePlayer(selectedPlayer.id);
                                setSelectedPlayer(null);
                            }}
                        >
                            Remove from Map
                        </MenuOption>
                        {/* Light cycle row (deferred-C backlog): mirrors the creature-row
                            sibling in ItemContextMenu exactly — the label names the CURRENT
                            setting (absent = the canonical bright default) and presses cycle
                            bright → dim → none through the shared LIGHT_CYCLE table in
                            hooks/usePlacedItems.js. The press does NOT close the menu (same
                            as the creature light row — visibility/rotate preserve the
                            selection; only door/remove dismiss it). */}
                        <MenuOption
                            x={menuX + 8}
                            y={menuY + 46}
                            fill="#ccc"
                            onActivate={() => handleCyclePlayerLight(selectedPlayer.id)}
                        >
                            {`Light: ${normalizeLightSetting(player.light)}`}
                        </MenuOption>
                    </>
                )}
                {canCosmetics && (
                    <TokenCosmeticsControls
                        playerName={player.name}
                        campaignName={campaignName}
                        menuX={menuX}
                        cosmeticsTop={cosmeticsTop}
                    />
                )}
                <MenuOption
                    x={menuX + 108}
                    y={menuY + 12}
                    fill="#999"
                    fontSize="10"
                    className="menu-close"
                    onActivate={() => setSelectedPlayer(null)}
                >
                    ✕
                </MenuOption>
            </g>
        </g>
    );
}

export default PlayerContextMenu;
