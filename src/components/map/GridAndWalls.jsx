import React from 'react';

const CELL_SIZE = 40;

const GridAndWalls = ({ gridSize, walls, isLocalhost, fog, bgFill }) => {
    const SVG_SIZE = gridSize * CELL_SIZE;

    return (
        <>
            {/* Grid background */}
            <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} className="grid-bg" style={{ fill: bgFill || '#1a1a1a' }} />

            {/* Vertical grid lines */}
            {Array.from({ length: gridSize + 1 }, (_, i) => (
                <line
                    key={`v-${i}`}
                    x1={i * CELL_SIZE}
                    y1="0"
                    x2={i * CELL_SIZE}
                    y2={SVG_SIZE}
                    className="grid-line"
                />
            ))}

            {/* Horizontal grid lines */}
            {Array.from({ length: gridSize + 1 }, (_, i) => (
                <line
                    key={`h-${i}`}
                    x1="0"
                    y1={i * CELL_SIZE}
                    x2={SVG_SIZE}
                    y2={i * CELL_SIZE}
                    className="grid-line"
                />
            ))}

            {/* Walls */}
            {Array.from(walls).filter(key => isLocalhost || !fog?.has(key)).map((key) => {
                const [gx, gy] = key.split(',').map(Number);
                return (
                    <rect
                        key={key}
                        x={gx * CELL_SIZE}
                        y={gy * CELL_SIZE}
                        width={CELL_SIZE}
                        height={CELL_SIZE}
                        className="wall-cell"
                    />
                );
            })}
        </>
    );
};

export default GridAndWalls;
