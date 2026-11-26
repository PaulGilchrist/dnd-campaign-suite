
import { tokenStackTransform } from '../../services/maps/tokenStackOffsets.js';
import { isTokenOwnedHere } from '../../services/maps/tokenOwnership.js';
import { TOOL_SELECT } from '../../config/mapConfig';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import {
    TOKEN_COSMETICS_KEY,
    getTokenRingClass,
    normalizeTokenCosmetics,
} from '../../config/tokenCosmetics.js';

const RADIUS = 20;

// Select-tool exclusion cue (backlog RH 2026-11-24): the marquee lane
// (useSelectMove.js) selects WALL CELLS + placedItems only — players live in
// players[] and are deliberately never group-selectable (documented lane
// split, useSelectMove.test.js header). While Select is armed the tokens wore
// NO chrome explaining the exclusion, so a box over a mixed selection looked
// like it silently dropped them. Cause-naming copy; the marquee law itself is
// unchanged — this is spectacle only, zero writes, pointer-events: none.
const NOT_GROUP_SELECTABLE_TITLE =
    'Player tokens aren\u2019t group-selectable \u2014 drag them individually';

// Ownership tint predicate (roadmap Item 6) lives in
// services/maps/tokenOwnership.js (isTokenOwnedHere) — exported there so the
// context-menu cosmetics lane shares the ONE ownership law.

// Player-token chrome (context-menu selection rect + visitor ownership ring
// + Select-tool exclusion cue) — hoisted out of the token renderer to keep it
// under the complexity ratchet; all three are inert overlays
// (pointer-events: none).
function PlayerTokenOverlays({ cx, cy, isSelected, isOwnedHere, selectArmed }) {
    return (
        <>
            {isSelected && (
                <rect
                    x={cx - RADIUS - 3}
                    y={cy - RADIUS - 3}
                    width={(RADIUS + 3) * 2}
                    height={(RADIUS + 3) * 2}
                    fill="none"
                    stroke="#FFD700"
                    strokeWidth={2}
                    rx={4}
                    strokeDasharray="4 2"
                    pointerEvents="none"
                />
            )}
            {isOwnedHere && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={RADIUS + 3}
                    className="owned-token-ring"
                    pointerEvents="none"
                />
            )}
            {/* Drawn last: the armed-tool cue outranks the passive chrome. */}
            {selectArmed && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={RADIUS + 4}
                    className="not-group-select-ring"
                    pointerEvents="none"
                />
            )}
        </>
    );
}

// Token <g> class list — hoisted to keep the renderer under the complexity
// ratchet (same lane as PlayerTokenOverlays). Base .creature-group bytes are
// byte-unchanged; .not-group-selectable is the armed-Select cue marker.
function tokenGroupClass({ stack, selectArmed }) {
    let cls = 'creature-group';
    if (stack) cls += ' token-buried';
    if (selectArmed) cls += ' not-group-selectable';
    return cls;
}

// Disc class list: the pre-Item-5 bytes (base + drag/selected states) first,
// plus the personal RING COLOR class from the palette (config/tokenCosmetics
// .js — CSS owns the color, never an inline style). Unset adds nothing.
function tokenDiscClass({ dragging, player, isSelected, ringClass }) {
    let cls = `creature-circle ${dragging?.playerId === player.id ? 'dragging' : ''} ${dragging?.playerId === player.id && dragging?.invalid ? 'drag-invalid' : ''} ${isSelected ? 'selected' : ''}`;
    if (ringClass) cls += ` ${ringClass}`;
    return cls;
}

function getPlayerImage(player, characters, campaignName) {
    if (!characters || !player) return null;
    const character = characters.find((c) => c.name === player.name);
    const relativePath = character?.imagePath;
    if (!relativePath) return null;
    if (relativePath.startsWith('http')) return relativePath;
    if (!campaignName) return null;
    return `campaigns/${campaignName}/${relativePath}`;
}

// One player token. Extracted per-token (Item 5) so the personalization read
// is a legal per-component hook: the cosmetics row rides the CHARACTER
// runtime bucket (tokenCosmetics — see config/tokenCosmetics.js for the full
// lane-trace rationale), subscribed read-only via useRuntimeValue exactly
// like the TokenStatusIndicators sibling lane, so an SSE echo of another
// creature's bucket never re-renders this token and an unset row renders the
// pre-Item-5 bytes untouched.
function PlayerToken({ player, characters, gridCenterX, gridCenterY, isLocalhost, dragging, handlePointerDown, selectedPlayer, setSelectedPlayer, campaignName, stack, selectArmed, localCharacterName }) {
    const cosmetics = normalizeTokenCosmetics(
        useRuntimeValue(player.name, TOKEN_COSMETICS_KEY, campaignName),
    );
    const ringClass = getTokenRingClass(cosmetics.ringColor);
    const cx = gridCenterX(player.gridX);
    const cy = gridCenterY(player.gridY);
    const img = getPlayerImage(player, characters, campaignName);
    const isSelected = selectedPlayer?.id === player.id;
    const isOwnedHere = isTokenOwnedHere({ isLocalhost, localCharacterName, playerName: player.name });
    // Context-menu opener (Item 5 amendment to the visitor authoring gate,
    // bug-visitor-map-token-menu-phantom-authoring): the GM still opens the
    // full authoring menu. A VISITOR may now open it for THEIR OWN token
    // only (same isTokenOwnedHere law) — and the menu itself then renders
    // just the cosmetics section (PlayerContextMenu.jsx), because every
    // authoring row (Remove/Light) writes the map doc, a lane flushSave
    // drops and the server 403s from a non-GM origin (phantom edits are the
    // bug this gate was born from). Foreign tokens stay fully opener-less:
    // the right-click bubbles to the svg root's preventDefault — no browser
    // menu, no menu at all (honest read-only face unchanged).
    const canOpenMenu = isLocalhost || isOwnedHere;

    return (
        <g
            onPointerDown={(e) => handlePointerDown(e, player.id)}
            className={tokenGroupClass({ stack, selectArmed })}
            transform={stack}
            style={{ cursor: 'grab' }}
        >
            {/* First child = the group's accessible name/tooltip
              (SVG <title> idiom) while Select is armed. */}
            {selectArmed && <title>{NOT_GROUP_SELECTABLE_TITLE}</title>}
            <defs>
                <clipPath id={`creature-clip-${player.id}`}>
                    <circle cx={cx} cy={cy} r={RADIUS} />
                </clipPath>
            </defs>
            <circle
                cx={cx}
                cy={cy}
                r={RADIUS}
                className={tokenDiscClass({ dragging, player, isSelected, ringClass })}
                onContextMenu={canOpenMenu ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedPlayer(player);
                } : undefined}
            />
            <PlayerTokenOverlays
                cx={cx}
                cy={cy}
                isSelected={isSelected}
                isOwnedHere={isOwnedHere}
                selectArmed={selectArmed}
            />
            {img ? (
                <image
                    xlinkHref={img}
                    x={cx - RADIUS + 2}
                    y={cy - RADIUS + 2}
                    width={RADIUS * 2 - 4}
                    height={RADIUS * 2 - 4}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#creature-clip-${player.id})`}
                    className="creature-image"
                />
            ) : (
                <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fff"
                    fontSize="16"
                    fontWeight="bold"
                    className="creature-initial"
                >
                    {player.name.charAt(0).toUpperCase()}
                </text>
            )}
            {/* Label visibility (Item 5): a stored hideLabel removes the
              label element entirely — no hidden-but-present chrome. */}
            {!cosmetics.hideLabel && (
                <text
                    x={cx}
                    y={cy + RADIUS - 4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="18"
                    fontWeight="bold"
                    className="creature-name"
                >
                    {player.name}
                </text>
            )}
            {/* Status chips + the uniform condition ring paint in the hoisted
                TokenStatusLayer (Map.jsx) above every token disc — RG 2026-11-19
                occlusion fix; this lane keeps no chip DOM. */}
        </g>
    );
}

const Players = ({ players, characters, gridCenterX, gridCenterY, isLocalhost, fog, dragging, handlePointerDown, selectedPlayer, setSelectedPlayer, campaignName, tokenOffsets, localCharacterName, tool }) => {
    // The cue gates on the toolbar tool ONLY (Ruler/Spell are separate
    // booleans that never set tool, Paint/Erase carry their own values) —
    // exactly one armed state produces the cue.
    const selectArmed = tool === TOOL_SELECT;

    return (
        <>
            {/*players guard (backlog 2026-10-27-M): a whole-document PUT that
              stripped `players` used to land here as undefined/null and throw —
              the render path degrades to an empty token list instead. */}
            {(players || []).map((player) => {
                // Hide creature from players if cell is fogged
                if (!isLocalhost && fog?.has(`${player.gridX},${player.gridY}`)) return null;
                // Same-cell stacking: a non-zero offset (buried token) rides a
                // transform AND the .token-buried fade class; stack tops and
                // single tokens keep no transform attribute and the plain
                // class (byte-unchanged). Map.css owns the fade value.
                const stack = tokenStackTransform(tokenOffsets, player.id);
                return (
                    <PlayerToken
                        key={player.id}
                        player={player}
                        characters={characters}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        isLocalhost={isLocalhost}
                        dragging={dragging}
                        handlePointerDown={handlePointerDown}
                        selectedPlayer={selectedPlayer}
                        setSelectedPlayer={setSelectedPlayer}
                        campaignName={campaignName}
                        stack={stack}
                        selectArmed={selectArmed}
                        localCharacterName={localCharacterName}
                    />
                );
            })}
        </>
    );
};

export default Players;
