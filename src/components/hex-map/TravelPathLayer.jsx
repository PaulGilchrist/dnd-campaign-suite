import React from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig';
import { hexToPixel } from '../../services/hexMapUtils';

function TravelPathLayer({ path, pathIndex, partyPosition }) {
  if (!path || path.length === 0) return null;

  const getHexCenter = (h) => {
    const p = hexToPixel(h.q, h.r, HEX_SIZE);
    return { x: p.x, y: p.y };
  };

  const linePoints = path.map(h => {
    const p = hexToPixel(h.q, h.r, HEX_SIZE);
    return `${p.x},${p.y}`;
  }).join(' ');

  const currentStep = pathIndex < path.length ? path[pathIndex] : null;
  const currentCenter = currentStep ? getHexCenter(currentStep) : null;
  const destinationHex = path[path.length - 1];
  const destCenter = getHexCenter(destinationHex);

  const behindPath = path.slice(0, pathIndex);
  const aheadPath = path.slice(pathIndex);

  const aheadPoints = aheadPath.map(h => {
    const p = hexToPixel(h.q, h.r, HEX_SIZE);
    return `${p.x},${p.y}`;
  }).join(' ');

  const behindPoints = behindPath.map(h => {
    const p = hexToPixel(h.q, h.r, HEX_SIZE);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <g className="travel-path-layer" pointerEvents="none">
      {behindPath.length > 0 && (
        <polyline
          points={behindPoints}
          fill="none"
          stroke="#FFD700"
          strokeWidth={2}
          strokeOpacity={0.4}
          strokeDasharray="4 3"
        />
      )}

      {aheadPath.length > 0 && (
        <polyline
          points={aheadPoints}
          fill="none"
          stroke="#FFD700"
          strokeWidth={3}
          strokeOpacity={0.8}
          strokeDasharray="6 4"
        />
      )}

      {currentCenter && (
        <circle
          cx={currentCenter.x}
          cy={currentCenter.y}
          r={HEX_SIZE * 0.6}
          fill="rgba(255, 215, 0, 0.15)"
          stroke="#FFD700"
          strokeWidth={2}
        />
      )}

      <rect
        x={destCenter.x - 18}
        y={destCenter.y - 18}
        width={36}
        height={36}
        fill="none"
        stroke="#FFD700"
        strokeWidth={2.5}
        strokeDasharray="5 3"
        rx={4}
      />
      <text
        x={destCenter.x}
        y={destCenter.y + 4}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFD700"
        fontSize={9}
        fontWeight="bold"
      >
        D
      </text>
    </g>
  );
}

export default TravelPathLayer;
