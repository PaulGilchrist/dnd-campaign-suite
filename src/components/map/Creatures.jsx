import React from 'react';

const RADIUS = 20;

const Creatures = ({ creatures, gridCenterX, gridCenterY, isLocalhost, fog, dragging, handlePointerDown }) => {
    return (
        <>
            {creatures.map((creature) => {
                const cx = gridCenterX(creature.gridX);
                const cy = gridCenterY(creature.gridY);
                // Hide creature from players if cell is fogged
                if (!isLocalhost && fog?.has(`${creature.gridX},${creature.gridY}`)) return null;

                return (
                    <g
                        key={creature.id}
                        onPointerDown={(e) => handlePointerDown(e, creature.id)}
                        className="creature-group"
                        style={{ cursor: 'grab' }}
                    >
                        <defs>
                            <clipPath id={`creature-clip-${creature.id}`}>
                                <circle cx={cx} cy={cy} r={RADIUS} />
                            </clipPath>
                        </defs>
                        <circle
                            cx={cx}
                            cy={cy}
                            r={RADIUS}
                            className={`creature-circle ${dragging?.creatureId === creature.id ? 'dragging' : ''}`}
                        />
                        {creature.imagePath ? (
                            <image
                                xlinkHref={creature.imagePath}
                                x={cx - RADIUS + 2}
                                y={cy - RADIUS + 2}
                                width={RADIUS * 2 - 4}
                                height={RADIUS * 2 - 4}
                                preserveAspectRatio="xMidYMid slice"
                                clipPath={`url(#creature-clip-${creature.id})`}
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
                                {creature.name.charAt(0).toUpperCase()}
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
                            {creature.name}
                        </text>
                    </g>
                );
            })}
        </>
    );
};

export default Creatures;
