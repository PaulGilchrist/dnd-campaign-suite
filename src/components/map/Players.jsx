import React from 'react';

const RADIUS = 20;

const Players = ({ players, gridCenterX, gridCenterY, isLocalhost, fog, dragging, handlePointerDown }) => {
    return (
        <>
            {players.map((player) => {
                const cx = gridCenterX(player.gridX);
                const cy = gridCenterY(player.gridY);
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
                            className={`creature-circle ${dragging?.creatureId === player.id ? 'dragging' : ''}`}
                        />
                        {player.imagePath ? (
                            <image
                                xlinkHref={player.imagePath}
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
