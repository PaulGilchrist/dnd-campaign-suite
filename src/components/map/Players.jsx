
import { tokenStackTransform } from '../../services/maps/tokenStackOffsets.js';
import TokenStatusIndicators from './TokenStatusIndicators.jsx';

const RADIUS = 20;

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

// Player-token chrome (context-menu selection rect + visitor ownership ring)
// — hoisted out of the token renderer to keep it under the complexity
// ratchet; both are inert overlays (pointer-events: none).
function PlayerTokenOverlays({ cx, cy, isSelected, isOwnedHere }) {
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
        </>
    );
}

const Players = ({ players, characters, gridCenterX, gridCenterY, isLocalhost, fog, dragging, handlePointerDown, selectedPlayer, setSelectedPlayer, campaignName, tokenOffsets, localCharacterName }) => {
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
                        className={stack ? 'creature-group token-buried' : 'creature-group'}
                        transform={stack}
                        style={{ cursor: 'grab' }}
                    >
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
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedPlayer(player);
                            }}
                        />
                        <PlayerTokenOverlays
                            cx={cx}
                            cy={cy}
                            isSelected={isSelected}
                            isOwnedHere={isOwnedHere}
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
                        <TokenStatusIndicators
                            campaignName={campaignName}
                            creatureName={player.name}
                            cx={cx}
                            cy={cy}
                        />
                    </g>
                );
            })}
        </>
    );
};

export default Players;
