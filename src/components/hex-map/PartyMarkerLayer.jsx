import React, { useRef } from 'react';
import { hexToPixel, pixelToHexSnapped, hexToSVGPath } from '../../services/hexMapUtils.js';

function PartyMarkerLayer({ position, HEX_SIZE, gridSize, onPositionChange, svgRef }) {
    const draggingRef = useRef(false);

    if (!position) return null;

    const center = hexToPixel(position.q, position.r, HEX_SIZE);
    const cx = center.x;
    const cy = center.y;
    const hexPath = hexToSVGPath(cx, cy, HEX_SIZE);

    const getHexFromEvent = (e) => {
        const svg = svgRef?.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;
        const hex = pixelToHexSnapped(svgX, svgY, HEX_SIZE);
        if (hex.q < 0 || hex.q >= gridSize || hex.r < 0 || hex.r >= gridSize) return null;
        return hex;
    };

    const handlePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = true;

        const handlePointerMove = (ev) => {
            if (!draggingRef.current) return;
            const hex = getHexFromEvent(ev);
            if (hex) {
                onPositionChange({ q: hex.q, r: hex.r });
            }
        };

        const handlePointerUp = () => {
            draggingRef.current = false;
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    return (
        <g className="party-marker-layer">
            <path
                d={hexPath}
                fill="#FFD700"
                fillOpacity={0.25}
                stroke="#FFD700"
                strokeWidth={3}
                strokeDasharray="6 3"
                style={{ cursor: 'grab' }}
                onPointerDown={handlePointerDown}
            />
            <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#FFD700"
                fontSize={HEX_SIZE * 0.8}
                fontWeight="bold"
                pointerEvents="none"
                style={{ textShadow: '0 0 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)' }}
            >
                P
            </text>
        </g>
    );
}

export default PartyMarkerLayer;
