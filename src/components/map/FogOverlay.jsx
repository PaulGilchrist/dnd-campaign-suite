import React from 'react';

const CELL_SIZE = 40;

const FogOverlay = ({ fog, isLocalhost, fogDragStart, fogDragEnd }) => {
    if (!isLocalhost || !fog) return null;

    return (
        <>
            {/* Fog of War overlay */}
            {Array.from(fog).map((key) => {
                const [gx, gy] = key.split(',').map(Number);
                return (
                    <rect
                        key={`fog-${key}`}
                        x={gx * CELL_SIZE}
                        y={gy * CELL_SIZE}
                        width={CELL_SIZE}
                        height={CELL_SIZE}
                        className="fog-cell"
                    />
                );
            })}

            {/* Fog drag selection rectangle preview */}
            {fogDragStart && fogDragEnd && (fogDragStart.gridX !== fogDragEnd.gridX || fogDragStart.gridY !== fogDragEnd.gridY) && (() => {
                const minX = Math.min(fogDragStart.gridX, fogDragEnd.gridX);
                const maxX = Math.max(fogDragStart.gridX, fogDragEnd.gridX);
                const minY = Math.min(fogDragStart.gridY, fogDragEnd.gridY);
                const maxY = Math.max(fogDragStart.gridY, fogDragEnd.gridY);
                return (
                    <rect
                        x={minX * CELL_SIZE}
                        y={minY * CELL_SIZE}
                        width={(maxX - minX + 1) * CELL_SIZE}
                        height={(maxY - minY + 1) * CELL_SIZE}
                        className="fog-preview"
                    />
                );
            })()}
        </>
    );
};

export default FogOverlay;
