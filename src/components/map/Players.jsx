
import { tokenStackTransform } from '../../services/maps/tokenStackOffsets.js';
import { TOOL_SELECT } from '../../config/mapConfig';

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

// Ownership tint predicate (roadmap Item 6) — hoisted to keep the token
// renderer under the complexity ratchet. Minimal honest model: characters
// are shared campaign data, so the only "mine" signal a device genuinely
// has is its OWN sidebar selection (App-level activeCharacter, threaded as
// localCharacterName — pure per-client local state, zero server writes).
// A visitor client tints the locally-selected character's token; the GM
// (localhost) sees every token neutral — the gold selection highlight stays
// the only selection language there.
function isTokenOwnedHere({ isLocalhost, localCharacterName, playerName }) {
    return !isLocalhost && !!localCharacterName && playerName === localCharacterName;
}

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

const Players = ({ players, characters, gridCenterX, gridCenterY, isLocalhost, fog, dragging, handlePointerDown, selectedPlayer, setSelectedPlayer, campaignName, tokenOffsets, localCharacterName, tool }) => {
    // The cue gates on the toolbar tool ONLY (Ruler/Spell are separate
    // booleans that never set tool, Paint/Erase carry their own values) —
    // exactly one armed state produces the cue.
    const selectArmed = tool === TOOL_SELECT;
    const getPlayerImage = (player, characters) => {
        if (!characters || !player) return null;
        const character = characters.find((c) => c.name === player.name);
        const relativePath = character?.imagePath;
        if (!relativePath) return null;
        if (relativePath.startsWith('http')) return relativePath;
        if (!campaignName) return null;
        return `campaigns/${campaignName}/${relativePath}`;
    };

    return (
        <>
            {/*players guard (backlog 2026-10-27-M): a whole-document PUT that
              stripped `players` used to land here as undefined/null and throw —
              the render path degrades to an empty token list instead. */}
            {(players || []).map((player) => {
                const cx = gridCenterX(player.gridX);
                const cy = gridCenterY(player.gridY);
                const img = getPlayerImage(player, characters);
                const isSelected = selectedPlayer?.id === player.id;
                // Same-cell stacking: a non-zero offset (buried token) rides a
                // transform AND the .token-buried fade class; stack tops and
                // single tokens keep no transform attribute and the plain
                // class (byte-unchanged). Map.css owns the fade value.
                const stack = tokenStackTransform(tokenOffsets, player.id);
                const isOwnedHere = isTokenOwnedHere({ isLocalhost, localCharacterName, playerName: player.name });
                // Hide creature from players if cell is fogged
                if (!isLocalhost && fog?.has(`${player.gridX},${player.gridY}`)) return null;

                return (
                    <g
                        key={player.id}
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
                            className={`creature-circle ${dragging?.playerId === player.id ? 'dragging' : ''} ${dragging?.playerId === player.id && dragging?.invalid ? 'drag-invalid' : ''} ${isSelected ? 'selected' : ''}`}
                            // Authoring chrome is GM-only: this opener is gated
                            // exactly like the placed-item sibling lanes, which
                            // only mount their context-menu hit areas for
                            // localhost (PlacedItems.jsx `{isLocalhost &&
                            // dragChrome}` / creature hit areas; IndoorPoiLayer
                            // .jsx `{isLocalhost && ...}`). Visitor-origin tabs
                            // used to get the full PlayerContextMenu — Light
                            // cycle + named Remove-from-Map confirm — whose
                            // writes flushSave silently drops, a phantom
                            // edit rolled back by the next unrelated echo
                            // (bug-visitor-map-token-menu-phantom-authoring).
                            // With no handler here a visitor right-click
                            // bubbles to the svg root's preventDefault: no
                            // browser menu, no phantom authoring menu.
                            onContextMenu={isLocalhost ? (e) => {
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
                        {/* Status chips paint in the hoisted TokenStatusLayer
                            (Map.jsx) above every token disc — RG 2026-11-19
                            occlusion fix; this lane keeps no chip DOM. */}
                    </g>
                );
            })}
        </>
    );
};

export default Players;
