
const RADIUS = 20;

const Players = ({ players, characters, gridCenterX, gridCenterY, isLocalhost, fog, dragging, handlePointerDown, selectedPlayer, setSelectedPlayer, campaignName }) => {
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
            {players.map((player) => {
                const cx = gridCenterX(player.gridX);
                const cy = gridCenterY(player.gridY);
                const img = getPlayerImage(player, characters);
                const isSelected = selectedPlayer?.id === player.id;
                // Hide creature from players if cell is fogged
                if (!isLocalhost && fog?.has(`${player.gridX},${player.gridY}`)) return null;

                return (
                    <g
                        key={player.id}
                        onPointerDown={(e) => handlePointerDown(e, player.id)}
                        className="creature-group"
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
                            className={`creature-circle ${dragging?.creatureId === player.id ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedPlayer(player);
                            }}
                        />
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
                    </g>
                );
            })}
        </>
    );
};

export default Players;
